import { describe, expect, it } from 'vitest';

import {
	DefaultVaultSessionManager,
	type VaultSessionManager,
} from './vault-session-manager.js';
import {
	SessionRegistrationConflictError,
	VaultLockedError,
} from '../errors/domain-errors.js';
import { FakeVaultSession } from '../testing/fakes.js';

function session(vaultId = 'v1'): FakeVaultSession {
	return new FakeVaultSession(vaultId, new Map(), []);
}

describe('DefaultVaultSessionManager', () => {
	it('registers a session and reports unlocked state', () => {
		const manager = new DefaultVaultSessionManager();
		expect(manager.isUnlocked('v1')).toBe(false);
		manager.register('v1', session('v1'));
		expect(manager.isUnlocked('v1')).toBe(true);
	});

	it('rejects a duplicate registration for the same vault', () => {
		const manager = new DefaultVaultSessionManager();
		manager.register('v1', session('v1'));
		expect(() => manager.register('v1', session('v1'))).toThrow(
			SessionRegistrationConflictError,
		);
	});

	it('runs an operation with the session', async () => {
		const manager = new DefaultVaultSessionManager();
		manager.register('v1', session('v1'));
		await expect(manager.run('v1', async () => 'ok')).resolves.toBe('ok');
	});

	it('rejects operations when the vault is not unlocked', async () => {
		const manager = new DefaultVaultSessionManager();
		await expect(manager.run('v1', async () => 'ok')).rejects.toBeInstanceOf(VaultLockedError);
	});

	it('locks: blocks new operations, drains in-flight, disposes the session', async () => {
		const manager = new DefaultVaultSessionManager();
		const live = session('v1');
		manager.register('v1', live);

		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const running = manager.run('v1', async () => {
			await gate;
			return 'done';
		});
		await Promise.resolve();

		const locking = manager.lock('v1');
		await expect(manager.run('v1', async () => 'x')).rejects.toBeInstanceOf(VaultLockedError);

		release();
		await expect(running).resolves.toBe('done');
		await locking;

		expect(live.isDisposed).toBe(true);
		expect(manager.isUnlocked('v1')).toBe(false);
	});

	it('is idempotent when locking an already-locked vault', async () => {
		const manager: VaultSessionManager = new DefaultVaultSessionManager();
		await expect(manager.lock('v1')).resolves.toBeUndefined();
		manager.register('v1', session('v1'));
		await manager.lock('v1');
		await expect(manager.lock('v1')).resolves.toBeUndefined();
	});

	it('starts empty after a simulated restart', () => {
		const first = new DefaultVaultSessionManager();
		first.register('v1', session('v1'));
		const restarted = new DefaultVaultSessionManager();
		expect(restarted.isUnlocked('v1')).toBe(false);
		expect(first.isUnlocked('v1')).toBe(true);
	});
});
