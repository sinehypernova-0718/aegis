import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createRuntime, startServer, type RuntimeFactories } from './lifecycle.js';
import {
	createFakeApp,
	createFakeContainer,
	createFakeDatabaseClient,
	createTestServerConfig,
} from './testing/fakes.js';

function makeFactories(overrides: Partial<RuntimeFactories> = {}): {
	factories: Partial<RuntimeFactories>;
	fake: ReturnType<typeof createFakeContainer>;
	db: ReturnType<typeof createFakeDatabaseClient>;
} {
	const fake = createFakeContainer();
	const db = createFakeDatabaseClient();
	const factories: Partial<RuntimeFactories> = {
		createDatabaseClient: () => db.client,
		createContainer: () => fake.container,
		buildApplication: () => createFakeApp().app,
		...overrides,
	};
	return { factories, fake, db };
}

describe('application lifecycle: startup', () => {
	it('builds a runtime and exposes app, container, and database client', async () => {
		const app = createFakeApp();
		const { factories } = makeFactories({ buildApplication: () => app.app });
		const runtime = await createRuntime({
			config: createTestServerConfig(),
			factories,
			logger: false,
		});
		expect(runtime.app).toBeDefined();
		expect(runtime.container).toBeDefined();
		expect(runtime.apiToken).toHaveLength(43);
		await runtime.shutdown();
	});

	it('closes the pool when container construction fails', async () => {
		const db = createFakeDatabaseClient();
		const failure = new Error('container failed');
		const factories: Partial<RuntimeFactories> = {
			createDatabaseClient: () => db.client,
			createContainer: () => {
				throw failure;
			},
		};
		await expect(
			createRuntime({ config: createTestServerConfig(), factories, logger: false }),
		).rejects.toBe(failure);
		expect(db.calls.close).toBe(1);
	});

	it('closes the pool when application construction fails', async () => {
		const db = createFakeDatabaseClient();
		const failure = new Error('app failed');
		const factories: Partial<RuntimeFactories> = {
			createDatabaseClient: () => db.client,
			createContainer: () => createFakeContainer().container,
			buildApplication: () => {
				throw failure;
			},
		};
		await expect(
			createRuntime({ config: createTestServerConfig(), factories, logger: false }),
		).rejects.toBe(failure);
		expect(db.calls.close).toBe(1);
	});

	it('preserves the database creation error without cleanup', async () => {
		const failure = new Error('database failed');
		const factories: Partial<RuntimeFactories> = {
			createDatabaseClient: () => {
				throw failure;
			},
		};
		await expect(
			createRuntime({ config: createTestServerConfig(), factories, logger: false }),
		).rejects.toBe(failure);
	});

	it('shuts down resources when binding fails', async () => {
		const app = createFakeApp({ listenError: new Error('bind failed') });
		const { factories, db, fake } = makeFactories({ buildApplication: () => app.app });

		await expect(
			startServer({ config: createTestServerConfig(), factories, logger: false }),
		).rejects.toThrow('bind failed');
		expect(app.calls.close).toBe(1);
		expect(db.calls.close).toBe(1);
		expect(fake.state.lockAllCalls).toBe(1);
	});
});

describe('application lifecycle: shutdown', () => {
	it('drains HTTP, locks sessions, then closes the pool', async () => {
		const order: string[] = [];
		const app = createFakeApp({ onClose: () => order.push('http') });
		const { factories, db, fake } = makeFactories({ buildApplication: () => app.app });
		fake.container.sessionManager.lockAll = async () => {
			order.push('sessions');
		};
		db.client.close = async () => {
			order.push('db');
		};

		const runtime = await createRuntime({
			config: createTestServerConfig(),
			factories,
			logger: false,
		});
		await runtime.shutdown();
		expect(order).toEqual(['http', 'sessions', 'db']);
	});

	it('force-closes connections when the graceful drain deadline expires', async () => {
		const order: string[] = [];
		let resolveClose!: () => void;
		const closePromise = new Promise<void>((resolve) => {
			resolveClose = resolve;
		});
		const app = createFakeApp({
			onClose: () => order.push('close'),
			onForceClose: () => {
				order.push('force-close');
				resolveClose();
			},
			closePromise,
		});
		const { factories, db, fake } = makeFactories({ buildApplication: () => app.app });
		fake.container.sessionManager.lockAll = async () => {
			order.push('sessions');
		};
		db.client.close = async () => {
			order.push('db');
		};

		const runtime = await createRuntime({
			config: createTestServerConfig({ shutdownTimeoutMs: 30, shutdownForceTimeoutMs: 500 }),
			factories,
			logger: false,
		});
		await runtime.shutdown();

		// Drain only completed after sockets were force-closed; the pool was
		// closed afterwards, never while close() was still pending.
		expect(app.calls.forceClose).toBe(1);
		expect(order).toEqual(['close', 'force-close', 'sessions', 'db']);
	});

	it('does not close the pool and wipes sessions when HTTP never drains', async () => {
		const order: string[] = [];
		const never = new Promise<void>(() => {});
		const app = createFakeApp({
			onForceClose: () => order.push('force-close'),
			closePromise: never,
		});
		const { factories, db, fake } = makeFactories({ buildApplication: () => app.app });
		fake.container.sessionManager.lockAll = async () => {
			order.push('sessions');
		};
		db.client.close = async () => {
			order.push('db');
		};

		const runtime = await createRuntime({
			config: createTestServerConfig({ shutdownTimeoutMs: 20, shutdownForceTimeoutMs: 20 }),
			factories,
			logger: false,
		});

		// A request may still be running, so the pool must stay open. Key
		// material is still wiped by lockAll, and the timeout is surfaced.
		await expect(runtime.shutdown()).rejects.toThrow(/did not drain/);
		expect(app.calls.forceClose).toBe(1);
		expect(order).toEqual(['force-close', 'sessions']);
		expect(db.calls.close).toBe(0);
	});

	it('is idempotent and shares one shutdown promise', async () => {
		let sessions = 0;
		let closes = 0;
		const app = createFakeApp();
		const { factories, db, fake } = makeFactories({ buildApplication: () => app.app });
		fake.container.sessionManager.lockAll = async () => {
			sessions += 1;
		};
		db.client.close = async () => {
			closes += 1;
		};

		const runtime = await createRuntime({
			config: createTestServerConfig(),
			factories,
			logger: false,
		});
		const first = runtime.shutdown();
		const second = runtime.shutdown();
		expect(first).toBe(second);
		await Promise.all([first, second]);
		await runtime.shutdown();
		expect(sessions).toBe(1);
		expect(closes).toBe(1);
		expect(app.calls.close).toBe(1);
	});

	it('continues cleanup when HTTP shutdown fails and preserves the first error', async () => {
		const order: string[] = [];
		const app = createFakeApp({
			onClose: () => order.push('http'),
			closeError: new Error('close failed'),
		});
		const { factories, db, fake } = makeFactories({ buildApplication: () => app.app });
		fake.container.sessionManager.lockAll = async () => {
			order.push('sessions');
		};
		db.client.close = async () => {
			order.push('db');
		};

		const runtime = await createRuntime({
			config: createTestServerConfig(),
			factories,
			logger: false,
		});
		await expect(runtime.shutdown()).rejects.toThrow('close failed');
		expect(order).toEqual(['http', 'sessions', 'db']);
	});

	it('writes and removes the per-launch token handoff file', async () => {
		const directory = mkdtempSync(join(tmpdir(), 'aegis-token-test-'));
		const tokenFile = join(directory, 'server.token');
		const { factories } = makeFactories();
		try {
			const runtime = await createRuntime({
				config: createTestServerConfig({ apiToken: null, tokenFile }),
				factories,
				logger: false,
			});
			expect(existsSync(tokenFile)).toBe(true);
			expect(readFileSync(tokenFile, 'utf8')).toBe(runtime.apiToken);
			expect(runtime.apiToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

			await runtime.shutdown();
			expect(existsSync(tokenFile)).toBe(false);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});
});
