import { describe, expect, it } from 'vitest';

import { DefaultVaultSessionManager } from './vault-session-manager.js';
import { SessionRegistrationConflictError, VaultLockedError } from '../errors/domain-errors.js';
import { FakeScheduler, FakeVaultSession } from '../testing/fakes.js';

function session(vaultId = 'v1'): FakeVaultSession {
	return new FakeVaultSession(vaultId, new Map(), []);
}

class CountingSession extends FakeVaultSession {
	disposeCount = 0;

	override dispose(): void {
		this.disposeCount += 1;
		super.dispose();
	}
}

function makeManager(options: { idleTimeoutMs?: number } = {}) {
	const scheduler = new FakeScheduler();
	const manager = new DefaultVaultSessionManager({
		idleTimeoutMs: options.idleTimeoutMs ?? 300_000,
		scheduler,
	});
	return { manager, scheduler };
}

describe('DefaultVaultSessionManager', () => {
	it('registers a session and reports unlocked state', () => {
		const { manager } = makeManager();
		expect(manager.isUnlocked('v1')).toBe(false);
		manager.register('v1', session('v1'));
		expect(manager.isUnlocked('v1')).toBe(true);
	});

	it('rejects a duplicate registration for the same vault', () => {
		const { manager } = makeManager();
		manager.register('v1', session('v1'));
		expect(() => manager.register('v1', session('v1'))).toThrow(SessionRegistrationConflictError);
	});

	it('runs an operation with the session', async () => {
		const { manager } = makeManager();
		manager.register('v1', session('v1'));
		await expect(manager.run('v1', async () => 'ok')).resolves.toBe('ok');
	});

	it('rejects operations when the vault is not unlocked', async () => {
		const { manager } = makeManager();
		await expect(manager.run('v1', async () => 'ok')).rejects.toBeInstanceOf(VaultLockedError);
	});

	it('locks: blocks new operations, drains in-flight, disposes the session', async () => {
		const { manager } = makeManager();
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
		const { manager } = makeManager();
		await expect(manager.lock('v1')).resolves.toBeUndefined();
		manager.register('v1', session('v1'));
		await manager.lock('v1');
		await expect(manager.lock('v1')).resolves.toBeUndefined();
	});

	it('shares one lock promise and disposes exactly once', async () => {
		const { manager } = makeManager();
		const live = new CountingSession('v1', new Map(), []);
		manager.register('v1', live);

		// Keep the lock pending so both callers observe the same promise.
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const running = manager.run('v1', async () => {
			await gate;
		});
		await Promise.resolve();

		const first = manager.lock('v1');
		const second = manager.lock('v1');
		expect(first).toBe(second);

		release();
		await Promise.all([first, second, running]);

		expect(live.disposeCount).toBe(1);
	});

	it('starts empty after a simulated restart', () => {
		const first = makeManager().manager;
		first.register('v1', session('v1'));
		const restarted = makeManager().manager;
		expect(restarted.isUnlocked('v1')).toBe(false);
		expect(first.isUnlocked('v1')).toBe(true);
	});

	it('locks automatically after the inactivity window', async () => {
		const { manager, scheduler } = makeManager({ idleTimeoutMs: 300_000 });
		const live = session('v1');
		manager.register('v1', live);

		expect(scheduler.active).toHaveLength(1);
		expect(scheduler.active[0]?.delayMs).toBe(300_000);

		scheduler.fireLatest();
		await Promise.resolve();

		expect(live.isDisposed).toBe(true);
		expect(manager.isUnlocked('v1')).toBe(false);
	});

	it('refreshes the idle timer after a successful operation only', async () => {
		const { manager, scheduler } = makeManager();
		manager.register('v1', session('v1'));
		const firstTimer = scheduler.tasks[0];

		await manager.run('v1', async () => 'ok');
		expect(firstTimer?.cancelled).toBe(true);
		expect(scheduler.active).toHaveLength(1);

		const secondTimer = scheduler.active[0];
		await expect(
			manager.run('v1', async () => {
				throw new Error('operation failed');
			}),
		).rejects.toThrow('operation failed');
		// A failed op is not activity: the current timer stays armed.
		expect(secondTimer?.cancelled).toBe(false);
	});

	it('cancels the idle timer when locking', async () => {
		const { manager, scheduler } = makeManager();
		manager.register('v1', session('v1'));
		await manager.lock('v1');
		expect(scheduler.active).toHaveLength(0);
	});

	it('ignores a stale idle timer for a later session under the same vault id', async () => {
		const { manager, scheduler } = makeManager();
		const first = session('v1');
		manager.register('v1', first);
		const firstTimer = scheduler.tasks[0];
		await manager.lock('v1');

		const second = session('v1');
		manager.register('v1', second);
		// Simulate a timer that was already queued before cancellation completed.
		firstTimer?.callback();

		expect(second.isDisposed).toBe(false);
		expect(manager.isUnlocked('v1')).toBe(true);
	});

	it('lockAll disposes every registered session and clears timers', async () => {
		const { manager, scheduler } = makeManager();
		const first = session('v1');
		const second = session('v2');
		manager.register('v1', first);
		manager.register('v2', second);
		expect(scheduler.active).toHaveLength(2);

		await manager.lockAll();

		expect(first.isDisposed).toBe(true);
		expect(second.isDisposed).toBe(true);
		expect(manager.isUnlocked('v1')).toBe(false);
		expect(manager.isUnlocked('v2')).toBe(false);
		expect(scheduler.active).toHaveLength(0);
		await expect(manager.lockAll()).resolves.toBeUndefined();
	});

	it('lockAll drains in-flight operations before disposing', async () => {
		const { manager } = makeManager();
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

		const locking = manager.lockAll();
		await expect(manager.run('v1', async () => 'x')).rejects.toBeInstanceOf(VaultLockedError);
		release();

		await expect(running).resolves.toBe('done');
		await locking;
		expect(live.isDisposed).toBe(true);
	});

	it('can disable the idle timer with zero', () => {
		const { manager, scheduler } = makeManager({ idleTimeoutMs: 0 });
		manager.register('v1', session('v1'));
		expect(scheduler.tasks).toHaveLength(0);
	});
});
