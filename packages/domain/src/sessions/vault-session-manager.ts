import type { VaultSession } from '@aegis/crypto';

import { SessionRegistrationConflictError, VaultLockedError } from '../errors/domain-errors.js';
import type { Scheduler } from '../ports/runtime.js';
import { DEFAULT_VAULT_IDLE_TIMEOUT_MS, systemScheduler } from './scheduler.js';

interface Entry {
	session: VaultSession;
	inFlight: number;
	state: 'open' | 'locking';
	drainWaiters: Array<() => void>;
	cancelIdleTimer: (() => void) | null;
	lockPromise: Promise<void> | null;
}

export interface VaultSessionManagerOptions {
	/** Inactivity window before automatic lock. `0` disables the idle timer. */
	readonly idleTimeoutMs?: number;
	/** Injectable timer port for deterministic tests. */
	readonly scheduler?: Scheduler;
}

// Read the state through a function so TypeScript does not keep the narrowing
// from the entry guard across `await` boundaries (the state can change while an
// operation is in flight).
function isLocking(entry: Entry): boolean {
	return entry.state === 'locking';
}

/**
 * Process-scoped vault session registry.
 *
 * Instance-scoped by design: the composition root creates exactly one and
 * injects it. It is never a module-level singleton and never serialized, so a
 * process restart yields an empty registry (every vault is locked).
 *
 * Concurrency policy:
 *  - `run` refuses to start when the vault is not `open` (throws VaultLockedError)
 *    and tracks in-flight operations. A successful operation refreshes the
 *    inactivity timer; a failed one does not.
 *  - `lock` flips the entry to `locking` (blocking new `run`s), cancels the idle
 *    timer, waits for in-flight operations to drain, then disposes and
 *    unregisters the session. Concurrent callers share one lock promise and the
 *    session is disposed exactly once.
 *  - `lockAll` locks every registered vault. Used by application shutdown.
 *
 * The manager never stores passphrases, plaintext credentials, or key material;
 * session objects are opaque and owned by `@aegis/crypto`.
 */
export interface VaultSessionManager {
	register(vaultId: string, session: VaultSession): void;
	isUnlocked(vaultId: string): boolean;
	run<T>(vaultId: string, fn: (session: VaultSession) => Promise<T>): Promise<T>;
	lock(vaultId: string): Promise<void>;
	lockAll(): Promise<void>;
}

export class DefaultVaultSessionManager implements VaultSessionManager {
	readonly #entries = new Map<string, Entry>();
	readonly #idleTimeoutMs: number;
	readonly #scheduler: Scheduler;

	constructor(options: VaultSessionManagerOptions = {}) {
		const idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_VAULT_IDLE_TIMEOUT_MS;
		if (!Number.isFinite(idleTimeoutMs) || idleTimeoutMs < 0) {
			throw new RangeError('idleTimeoutMs must be a non-negative finite number');
		}
		this.#idleTimeoutMs = idleTimeoutMs;
		this.#scheduler = options.scheduler ?? systemScheduler;
	}

	register(vaultId: string, session: VaultSession): void {
		if (typeof vaultId !== 'string' || vaultId.length === 0) {
			throw new TypeError('vaultId must be a non-empty string');
		}
		// The session must belong to the vault it is registered under. This is
		// checked before any registry mutation so a session for one vault can
		// never be reached through another vault's id.
		if (session.vaultId !== vaultId) {
			throw new SessionRegistrationConflictError(
				'session vault id does not match the registration vault id',
			);
		}
		// Synchronous check-and-set: JS single-threaded execution makes this
		// race-free, so at most one session exists per vault.
		if (this.#entries.has(vaultId)) {
			throw new SessionRegistrationConflictError(`vault ${vaultId} already has a session`);
		}
		const entry: Entry = {
			session,
			inFlight: 0,
			state: 'open',
			drainWaiters: [],
			cancelIdleTimer: null,
			lockPromise: null,
		};
		this.#entries.set(vaultId, entry);
		this.#armIdleTimer(vaultId, entry);
	}

	isUnlocked(vaultId: string): boolean {
		const entry = this.#entries.get(vaultId);
		return entry !== undefined && entry.state === 'open' && !entry.session.isDisposed;
	}

	async run<T>(vaultId: string, fn: (session: VaultSession) => Promise<T>): Promise<T> {
		const entry = this.#entries.get(vaultId);
		if (!entry || entry.state !== 'open') {
			throw new VaultLockedError(`vault ${vaultId} is locked`);
		}
		entry.inFlight += 1;
		try {
			const result = await fn(entry.session);
			// Only successful operations count as activity. A lock that started
			// while this operation was in flight must not be undone.
			this.#refreshIdleTimer(vaultId, entry);
			return result;
		} finally {
			entry.inFlight -= 1;
			if (entry.inFlight === 0 && isLocking(entry)) {
				const waiters = entry.drainWaiters;
				entry.drainWaiters = [];
				for (const resolve of waiters) resolve();
			}
		}
	}

	lock(vaultId: string): Promise<void> {
		const entry = this.#entries.get(vaultId);
		if (!entry) return Promise.resolve(); // idempotent: already locked
		// Concurrent lock callers share the original promise so the session is
		// disposed exactly once.
		if (entry.lockPromise !== null) return entry.lockPromise;
		entry.state = 'locking';
		this.#clearIdleTimer(entry);
		entry.lockPromise = this.#disposeEntry(vaultId, entry);
		return entry.lockPromise;
	}

	async lockAll(): Promise<void> {
		// Lock everything currently registered. Callers stop new work (HTTP
		// shutdown) before invoking this; the loop still tolerates a session that
		// is registered while an earlier drain is in progress.
		let firstError: unknown;
		// A bounded number of passes tolerates a session registered while an
		// earlier drain is in progress without spinning forever on a pathological
		// reconnect loop.
		for (let pass = 0; pass < 100 && this.#entries.size > 0; pass += 1) {
			const ids = [...this.#entries.keys()];
			for (const id of ids) {
				try {
					await this.lock(id);
				} catch (error) {
					firstError ??= error;
				}
			}
			if (firstError !== undefined) break;
		}
		if (firstError !== undefined) throw firstError;
	}

	async #disposeEntry(vaultId: string, entry: Entry): Promise<void> {
		if (entry.inFlight > 0) {
			await new Promise<void>((resolve) => {
				entry.drainWaiters.push(resolve);
			});
		}
		// Remove the registry entry before disposal so a concurrent `register`
		// never observes a half-disposed session, and `lockAll` always progresses.
		this.#entries.delete(vaultId);
		entry.session.dispose();
	}

	#armIdleTimer(vaultId: string, entry: Entry): void {
		if (this.#idleTimeoutMs <= 0) return;
		this.#clearIdleTimer(entry);
		entry.cancelIdleTimer = this.#scheduler.schedule(this.#idleTimeoutMs, () => {
			// Ignore a stale timer from a previous session under the same vault id.
			if (this.#entries.get(vaultId) !== entry) return;
			// Timer callbacks cannot await; lock is idempotent and failures must
			// not surface as unhandled rejections.
			void this.lock(vaultId).catch(() => {});
		});
	}

	#refreshIdleTimer(vaultId: string, entry: Entry): void {
		if (this.#entries.get(vaultId) !== entry || entry.state !== 'open') return;
		this.#armIdleTimer(vaultId, entry);
	}

	#clearIdleTimer(entry: Entry): void {
		const cancel = entry.cancelIdleTimer;
		entry.cancelIdleTimer = null;
		if (cancel) cancel();
	}
}
