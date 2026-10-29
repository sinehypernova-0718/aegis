import { describe, expect, it } from 'vitest';

import { GetVaultStatus } from './get-vault-status.js';
import { InitializeVault } from './initialize-vault.js';
import { LockVault } from './lock-vault.js';
import { UnlockVault } from './unlock-vault.js';
import {
	InvalidKeyEnvelopeError,
	PersistenceError,
	SessionRegistrationConflictError,
	UnlockRejectedError,
	UnsupportedEncryptionFormatError,
	VaultAlreadyInitializedError,
	VaultAlreadyUnlockedError,
	VaultLockedError,
	VaultNotFoundError,
} from '../../errors/domain-errors.js';
import type { VaultSessionManager } from '../../sessions/vault-session-manager.js';
import { DefaultVaultSessionManager } from '../../sessions/vault-session-manager.js';
import {
	FakeScheduler,
	FakeVaultCryptoPort,
	FixedClock,
	InMemoryVaultRepository,
	SequentialIdGenerator,
} from '../../testing/fakes.js';

const PURPOSE = 'primary';

function makeDeps() {
	const vaultRepository = new InMemoryVaultRepository();
	const sessionManager = new DefaultVaultSessionManager({ scheduler: new FakeScheduler() });
	const crypto = new FakeVaultCryptoPort();
	const clock = new FixedClock();
	const ids = new SequentialIdGenerator();
	const keyEnvelopePurpose = PURPOSE;
	return { vaultRepository, sessionManager, crypto, clock, ids, keyEnvelopePurpose };
}

function initialize(deps: ReturnType<typeof makeDeps>) {
	return new InitializeVault(deps);
}
function unlock(deps: ReturnType<typeof makeDeps>) {
	return new UnlockVault(deps);
}
function lock(deps: ReturnType<typeof makeDeps>) {
	return new LockVault(deps);
}
function status(deps: ReturnType<typeof makeDeps>) {
	return new GetVaultStatus(deps);
}

describe('InitializeVault', () => {
	it('persists before registering and reports unlocked', async () => {
		const deps = makeDeps();
		const result = await initialize(deps).execute({ passphrase: 'pw' });
		expect(result.runtimeState).toBe('unlocked');
		expect(deps.vaultRepository.vaults.size).toBe(1);
		expect(deps.vaultRepository.envelopes).toHaveLength(1);
		expect(deps.sessionManager.isUnlocked(result.vaultId)).toBe(true);
	});

	it('disposes the session and does not register when persistence fails', async () => {
		const deps = makeDeps();
		deps.vaultRepository.failInitialize = true;
		await expect(initialize(deps).execute({ passphrase: 'pw' })).rejects.toBeInstanceOf(
			PersistenceError,
		);
		expect(deps.crypto.createdSessions[0]?.isDisposed).toBe(true);
		expect(deps.vaultRepository.vaults.size).toBe(0);
		expect(deps.sessionManager.isUnlocked(deps.crypto.createdSessions[0]?.vaultId ?? '')).toBe(
			false,
		);
	});

	it('keeps the vault durable when registration fails after commit', async () => {
		const deps = makeDeps();
		const throwingManager: VaultSessionManager = {
			register: () => {
				throw new SessionRegistrationConflictError();
			},
			isUnlocked: () => false,
			run: async () => {
				throw new VaultLockedError();
			},
			lock: async () => {},
			lockAll: async () => {},
		};
		const useCase = new InitializeVault({ ...deps, sessionManager: throwingManager });
		const result = await useCase.execute({ passphrase: 'pw' });
		expect(result.runtimeState).toBe('locked');
		expect(deps.vaultRepository.vaults.size).toBe(1);
		expect(deps.crypto.createdSessions[0]?.isDisposed).toBe(true);
	});

	it('rejects a duplicate vault id', async () => {
		const deps = makeDeps();
		const first = await initialize(deps).execute({ passphrase: 'pw' });
		await expect(
			initialize(deps).execute({ passphrase: 'pw', vaultId: first.vaultId }),
		).rejects.toBeInstanceOf(VaultAlreadyInitializedError);
	});

	it('allows distinct vault ids (multi-vault)', async () => {
		const deps = makeDeps();
		const a = await initialize(deps).execute({ passphrase: 'pw' });
		const b = await initialize(deps).execute({ passphrase: 'pw' });
		expect(a.vaultId).not.toBe(b.vaultId);
		expect(deps.vaultRepository.vaults.size).toBe(2);
	});

	it('rejects an empty passphrase', async () => {
		const deps = makeDeps();
		await expect(initialize(deps).execute({ passphrase: '' })).rejects.toThrow();
	});
});

describe('UnlockVault', () => {
	async function initialized() {
		const deps = makeDeps();
		const result = await initialize(deps).execute({ passphrase: 'pw' });
		await lock(deps).execute({ vaultId: result.vaultId });
		return { deps, vaultId: result.vaultId };
	}

	it('unlocks from the persisted envelope', async () => {
		const { deps, vaultId } = await initialized();
		const result = await unlock(deps).execute({ vaultId, passphrase: 'pw' });
		expect(result.status).toBe('unlocked');
		expect(deps.sessionManager.isUnlocked(vaultId)).toBe(true);
	});

	it('rejects a wrong passphrase without registering', async () => {
		const { deps, vaultId } = await initialized();
		deps.crypto.behavior = 'wrong';
		await expect(unlock(deps).execute({ vaultId, passphrase: 'bad' })).rejects.toBeInstanceOf(
			UnlockRejectedError,
		);
		expect(deps.sessionManager.isUnlocked(vaultId)).toBe(false);
	});

	it('maps an unsupported envelope version', async () => {
		const { deps, vaultId } = await initialized();
		deps.crypto.behavior = 'unsupported';
		await expect(unlock(deps).execute({ vaultId, passphrase: 'pw' })).rejects.toBeInstanceOf(
			UnsupportedEncryptionFormatError,
		);
	});

	it('maps a malformed envelope', async () => {
		const { deps, vaultId } = await initialized();
		deps.crypto.behavior = 'malformed';
		await expect(unlock(deps).execute({ vaultId, passphrase: 'pw' })).rejects.toBeInstanceOf(
			InvalidKeyEnvelopeError,
		);
	});

	it('rejects an unknown vault', async () => {
		const deps = makeDeps();
		await expect(
			unlock(deps).execute({ vaultId: '00000000-0000-4000-8000-0000000000ff', passphrase: 'pw' }),
		).rejects.toBeInstanceOf(VaultNotFoundError);
	});

	it('rejects when no active envelope exists', async () => {
		const deps = makeDeps();
		const vaultId = '00000000-0000-4000-8000-0000000000aa';
		deps.vaultRepository.vaults.set(vaultId, {
			id: vaultId,
			status: 'initialized',
			encryptionFormatVersion: 1,
			createdAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-01-01T00:00:00.000Z',
		});
		await expect(unlock(deps).execute({ vaultId, passphrase: 'pw' })).rejects.toBeInstanceOf(
			InvalidKeyEnvelopeError,
		);
	});

	it('rejects unlocking an already-unlocked vault', async () => {
		const deps = makeDeps();
		const { vaultId } = await initialize(deps).execute({ passphrase: 'pw' });
		await expect(unlock(deps).execute({ vaultId, passphrase: 'pw' })).rejects.toBeInstanceOf(
			VaultAlreadyUnlockedError,
		);
	});

	it('registers at most one session for two concurrent unlocks', async () => {
		const { deps, vaultId } = await initialized();
		const results = await Promise.allSettled([
			unlock(deps).execute({ vaultId, passphrase: 'pw' }),
			unlock(deps).execute({ vaultId, passphrase: 'pw' }),
		]);
		const fulfilled = results.filter((r) => r.status === 'fulfilled');
		const rejected = results.filter((r) => r.status === 'rejected');
		expect(fulfilled).toHaveLength(1);
		expect(rejected).toHaveLength(1);
		expect(deps.sessionManager.isUnlocked(vaultId)).toBe(true);
	});
});

describe('LockVault and GetVaultStatus', () => {
	it('locks and reports durable-vs-runtime status', async () => {
		const deps = makeDeps();
		const { vaultId } = await initialize(deps).execute({ passphrase: 'pw' });

		await expect(status(deps).execute({ vaultId })).resolves.toEqual({
			status: 'unlocked',
			vaultId,
		});

		await expect(lock(deps).execute({ vaultId })).resolves.toEqual({
			vaultId,
			status: 'locked',
		});
		await expect(status(deps).execute({ vaultId })).resolves.toEqual({
			status: 'locked',
			vaultId,
		});
		await expect(
			status(deps).execute({ vaultId: '00000000-0000-4000-8000-0000000000ff' }),
		).resolves.toEqual({ status: 'uninitialized', vaultId: null });
	});
});
