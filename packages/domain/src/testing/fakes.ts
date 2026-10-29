import type { EncryptedRecord, VaultKeyEnvelope, VaultSession } from '@aegis/crypto';

import type {
	CredentialListOptions,
	CredentialRecordRow,
	CredentialRepositoryPort,
	NewCredentialRecordRow,
} from '../ports/credential-repository.js';
import type { Clock, IdGenerator, Scheduler } from '../ports/runtime.js';
import type {
	CreateVaultSessionRequest,
	UnlockVaultSessionRequest,
	VaultCryptoPort,
} from '../ports/vault-crypto.js';
import type {
	NewPersistedKeyEnvelope,
	NewVaultState,
	PersistedKeyEnvelope,
	VaultRepositoryPort,
	VaultState,
} from '../ports/vault-repository.js';

function codedError(code: string): Error {
	const error = new Error(code);
	(error as { code?: string }).code = code;
	return error;
}

function namedError(name: string): Error {
	const error = new Error(name);
	error.name = name;
	return error;
}

export function fakeEnvelope(): VaultKeyEnvelope {
	return {
		version: 1,
		kdf: {
			algorithm: 'argon2id',
			salt: 'AAAAAAAAAAAAAAAAAAAAAA',
			memoryKiB: 65_536,
			passes: 3,
			parallelism: 4,
			tagLength: 32,
		},
		wrap: {
			algorithm: 'xchacha20-poly1305',
			nonce: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
			ciphertext: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
		},
	} as unknown as VaultKeyEnvelope;
}

/** In-memory session that stores plaintext by record id. No real crypto. */
export class FakeVaultSession implements VaultSession {
	readonly vaultId: string;
	readonly #store: Map<string, Uint8Array>;
	readonly #nonces: string[];
	#disposed = false;

	constructor(vaultId: string, store: Map<string, Uint8Array>, nonces: string[]) {
		this.vaultId = vaultId;
		this.#store = store;
		this.#nonces = nonces;
	}

	get isDisposed(): boolean {
		return this.#disposed;
	}

	encryptRecord(input: { recordId: string; plaintext: Uint8Array }): EncryptedRecord {
		if (this.#disposed) throw codedError('CRYPTO_SESSION_DISPOSED');
		const nonce = new Uint8Array(24).fill(this.#nonces.length + 1);
		this.#nonces.push(Buffer.from(nonce).toString('hex'));
		this.#store.set(input.recordId, input.plaintext.slice());
		return { encryptionVersion: 1, nonce, ciphertext: input.plaintext.slice() };
	}

	decryptRecord(input: {
		recordId: string;
		encryptionVersion: number;
		nonce: Uint8Array;
		ciphertext: Uint8Array;
	}): Uint8Array {
		if (this.#disposed) throw codedError('CRYPTO_SESSION_DISPOSED');
		if (input.encryptionVersion !== 1) throw codedError('CRYPTO_UNSUPPORTED_VERSION');
		const value = this.#store.get(input.recordId);
		if (!value) throw codedError('CRYPTO_AUTHENTICATION_FAILED');
		return value.slice();
	}

	dispose(): void {
		this.#disposed = true;
		this.#store.clear();
	}
}

export type FakeUnlockBehavior = 'success' | 'wrong' | 'unsupported' | 'malformed';

export class FakeVaultCryptoPort implements VaultCryptoPort {
	readonly store = new Map<string, Uint8Array>();
	readonly nonces: string[] = [];
	readonly createdSessions: FakeVaultSession[] = [];
	createCount = 0;
	unlockCount = 0;
	behavior: FakeUnlockBehavior = 'success';

	createStore(): Map<string, Uint8Array> {
		return this.store;
	}

	async createVaultSession(
		input: CreateVaultSessionRequest,
	): Promise<{ envelope: VaultKeyEnvelope; session: VaultSession }> {
		this.createCount += 1;
		const session = new FakeVaultSession(input.vaultId, this.store, this.nonces);
		this.createdSessions.push(session);
		return { envelope: fakeEnvelope(), session };
	}

	async unlockVaultSession(input: UnlockVaultSessionRequest): Promise<VaultSession> {
		this.unlockCount += 1;
		if (this.behavior === 'wrong') throw codedError('CRYPTO_AUTHENTICATION_FAILED');
		if (this.behavior === 'unsupported') throw codedError('CRYPTO_UNSUPPORTED_VERSION');
		if (this.behavior === 'malformed') throw codedError('CRYPTO_ENVELOPE_INVALID');
		return new FakeVaultSession(input.vaultId, this.store, this.nonces);
	}

	validateEnvelope(input: unknown): VaultKeyEnvelope {
		if (this.behavior === 'unsupported') throw codedError('CRYPTO_UNSUPPORTED_VERSION');
		if (this.behavior === 'malformed') throw codedError('CRYPTO_ENVELOPE_INVALID');
		return input as VaultKeyEnvelope;
	}
}

export class InMemoryVaultRepository implements VaultRepositoryPort {
	readonly vaults = new Map<string, VaultState>();
	readonly envelopes: PersistedKeyEnvelope[] = [];
	failInitialize = false;

	async getVaultById(id: string): Promise<VaultState | null> {
		return this.vaults.get(id) ?? null;
	}

	async initializeVaultWithKeyEnvelopes(
		vault: NewVaultState,
		envelopes: readonly NewPersistedKeyEnvelope[],
	): Promise<VaultState> {
		if (this.failInitialize) throw namedError('DatabaseError');
		if (this.vaults.has(vault.id)) throw namedError('UniqueConstraintViolationError');
		const state: VaultState = {
			id: vault.id,
			status: vault.status,
			encryptionFormatVersion: vault.encryptionFormatVersion,
			createdAt: vault.createdAt,
			updatedAt: vault.updatedAt,
		};
		this.vaults.set(vault.id, state);
		for (const envelope of envelopes) this.envelopes.push({ ...envelope });
		return state;
	}

	async getActiveKeyEnvelope(
		vaultId: string,
		purpose: string,
	): Promise<PersistedKeyEnvelope | null> {
		const matches = this.envelopes.filter(
			(envelope) => envelope.vaultId === vaultId && envelope.purpose === purpose,
		);
		return matches.length > 0 ? (matches[matches.length - 1] as PersistedKeyEnvelope) : null;
	}
}

export class InMemoryCredentialRepository implements CredentialRepositoryPort {
	readonly records = new Map<string, CredentialRecordRow>();
	failCreate = false;
	failUpdate = false;
	failList = false;
	failDelete = false;

	async createRecord(input: NewCredentialRecordRow): Promise<CredentialRecordRow> {
		if (this.failCreate) throw namedError('DatabaseError');
		const row: CredentialRecordRow = { ...input };
		this.records.set(row.id, row);
		return row;
	}

	async getRecordById(vaultId: string, id: string): Promise<CredentialRecordRow | null> {
		const row = this.records.get(id);
		return row && row.vaultId === vaultId ? row : null;
	}

	async listRecordsByVault(
		vaultId: string,
		options: CredentialListOptions,
	): Promise<CredentialRecordRow[]> {
		if (this.failList) throw namedError('DatabaseError');
		let rows = [...this.records.values()].filter((row) => row.vaultId === vaultId);
		rows.sort((a, b) =>
			a.createdAt === b.createdAt
				? a.id < b.id
					? -1
					: a.id > b.id
						? 1
						: 0
				: a.createdAt < b.createdAt
					? -1
					: 1,
		);
		if (options.after) {
			const { createdAt, id } = options.after;
			rows = rows.filter(
				(row) => row.createdAt > createdAt || (row.createdAt === createdAt && row.id > id),
			);
		}
		return rows.slice(0, options.limit);
	}

	async updateRecord(input: CredentialRecordRow): Promise<CredentialRecordRow> {
		if (this.failUpdate) throw namedError('DatabaseError');
		const existing = this.records.get(input.id);
		if (!existing || existing.vaultId !== input.vaultId) throw namedError('RecordNotFoundError');
		const row: CredentialRecordRow = { ...input };
		this.records.set(row.id, row);
		return row;
	}

	async deleteRecord(vaultId: string, id: string): Promise<boolean> {
		if (this.failDelete) throw namedError('DatabaseError');
		const row = this.records.get(id);
		if (!row || row.vaultId !== vaultId) return false;
		this.records.delete(id);
		return true;
	}
}

export class FixedClock implements Clock {
	#millis: number;

	constructor(start = Date.parse('2026-01-01T00:00:00.000Z')) {
		this.#millis = start;
	}

	now(): string {
		const value = new Date(this.#millis).toISOString();
		this.#millis += 1;
		return value;
	}
}

export class SequentialIdGenerator implements IdGenerator {
	#n = 0;

	generate(): string {
		this.#n += 1;
		return `00000000-0000-4000-8000-${String(this.#n).padStart(12, '0')}`;
	}
}

export interface ScheduledTask {
	readonly delayMs: number;
	readonly callback: () => void;
	cancelled: boolean;
}

/**
 * Deterministic scheduler for tests. Tasks only run when explicitly fired, so
 * idle-lock behaviour never depends on wall-clock time.
 */
export class FakeScheduler implements Scheduler {
	readonly tasks: ScheduledTask[] = [];

	schedule(delayMs: number, callback: () => void): () => void {
		const task: ScheduledTask = { delayMs, callback, cancelled: false };
		this.tasks.push(task);
		return () => {
			task.cancelled = true;
		};
	}

	get active(): ScheduledTask[] {
		return this.tasks.filter((task) => !task.cancelled);
	}

	/** Fire the most recently scheduled, still-active task. */
	fireLatest(): void {
		const task = this.active[this.active.length - 1];
		if (!task) throw new Error('no active scheduled task');
		task.cancelled = true;
		task.callback();
	}

	/** Fire every currently active task (snapshot; later tasks are untouched). */
	fireAll(): void {
		for (const task of this.active) {
			task.cancelled = true;
			task.callback();
		}
	}
}
