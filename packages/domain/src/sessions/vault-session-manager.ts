import type { VaultSession } from '@aegis/crypto';

import { SessionRegistrationConflictError, VaultLockedError } from '../errors/domain-errors.js';

interface Entry {
	session: VaultSession;
	inFlight: number;
	state: 'open' | 'locking';
	drainWaiters: Array<() => void>;
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
 *    and tracks in-flight operations.
 *  - `lock` flips the entry to `locking` (blocking new `run`s), waits for
 *    in-flight operations to drain, then disposes and unregisters the session.
 *    It is idempotent per vault.
 */
export interface VaultSessionManager {
	register(vaultId: string, session: VaultSession): void;
	isUnlocked(vaultId: string): boolean;
	run<T>(vaultId: string, fn: (session: VaultSession) => Promise<T>): Promise<T>;
	lock(vaultId: string): Promise<void>;
}

export class DefaultVaultSessionManager implements VaultSessionManager {
	readonly #entries = new Map<string, Entry>();

	register(vaultId: string, session: VaultSession): void {
		if (typeof vaultId !== 'string' || vaultId.length === 0) {
			throw new TypeError('vaultId must be a non-empty string');
		}
		// Synchronous check-and-set: JS single-threaded execution makes this
		// race-free, so at most one session exists per vault.
		if (this.#entries.has(vaultId)) {
			throw new SessionRegistrationConflictError(`vault ${vaultId} already has a session`);
		}
		this.#entries.set(vaultId, { session, inFlight: 0, state: 'open', drainWaiters: [] });
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
			return await fn(entry.session);
		} finally {
			entry.inFlight -= 1;
			if (entry.inFlight === 0 && isLocking(entry)) {
				const waiters = entry.drainWaiters;
				entry.drainWaiters = [];
				for (const resolve of waiters) resolve();
			}
		}
	}

	async lock(vaultId: string): Promise<void> {
		const entry = this.#entries.get(vaultId);
		if (!entry) return; // idempotent: already locked
		if (entry.state === 'open') entry.state = 'locking';
		if (entry.inFlight > 0) {
			await new Promise<void>((resolve) => {
				entry.drainWaiters.push(resolve);
			});
		}
		entry.session.dispose();
		this.#entries.delete(vaultId);
	}
}
