import { Writable } from 'node:stream';
import type { FastifyInstance, FastifyServerOptions } from 'fastify';
import { describe, expect, it } from 'vitest';
import { PersistenceError, VaultAlreadyInitializedError, VaultLockedError } from '@aegis/domain';

import { buildServer } from './build-server.js';
import { UnlockThrottle } from './auth.js';
import type { AppContainer } from './dependencies.js';
import {
	CREDENTIAL_ID,
	TEST_API_TOKEN,
	TEST_CORRECT_PASSPHRASE,
	TEST_NOTE_MARKER,
	TEST_SECRET_MARKER,
	TEST_VAULT_ID,
	TEST_WRONG_PASSPHRASE,
	createFakeContainer,
} from '../testing/fakes.js';

const PORT = 7_787;
const AUTH = `Bearer ${TEST_API_TOKEN}`;

interface TestRequest {
	readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE';
	readonly url: string;
	readonly payload?: string | object;
	readonly headers?: Record<string, string>;
}

function makeApp(
	options: {
		container?: AppContainer;
		checkReadiness?: () => Promise<void>;
		unlockThrottle?: UnlockThrottle;
		bodyLimitBytes?: number;
		logger?: FastifyServerOptions['logger'];
	} = {},
): { app: FastifyInstance; fake: ReturnType<typeof createFakeContainer> } {
	const fake = createFakeContainer();
	const container = options.container ?? fake.container;
	const app = buildServer({
		container,
		apiToken: TEST_API_TOKEN,
		port: PORT,
		bodyLimitBytes: options.bodyLimitBytes ?? 4_096,
		logLevel: 'silent',
		checkReadiness: options.checkReadiness ?? (async () => {}),
		...(options.unlockThrottle !== undefined ? { unlockThrottle: options.unlockThrottle } : {}),
		...(options.logger !== undefined ? { logger: options.logger } : {}),
	});
	return { app, fake };
}

async function inject(app: FastifyInstance, request: TestRequest) {
	return app.inject({
		method: request.method,
		url: request.url,
		...(request.payload !== undefined ? { payload: request.payload } : {}),
		headers: {
			host: `127.0.0.1:${PORT}`,
			authorization: AUTH,
			...request.headers,
		},
	});
}

describe('server boundary: health', () => {
	it('serves liveness without touching the database', async () => {
		const { app } = makeApp({
			checkReadiness: async () => {
				throw new Error('liveness must not check the database');
			},
		});
		const response = await inject(app, { method: 'GET', url: '/healthz' });
		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ status: 'ok' });
		await app.close();
	});

	it('reports readiness success and failure', async () => {
		const ready = makeApp({ checkReadiness: async () => {} });
		const readyResponse = await inject(ready.app, { method: 'GET', url: '/readyz' });
		expect(readyResponse.statusCode).toBe(200);
		expect(readyResponse.json()).toEqual({ status: 'ready' });
		await ready.app.close();

		const unavailable = makeApp({
			checkReadiness: async () => {
				throw new Error('database connection refused: postgres://secret');
			},
		});
		const failed = await inject(unavailable.app, { method: 'GET', url: '/readyz' });
		expect(failed.statusCode).toBe(503);
		expect(failed.json()).toEqual({ status: 'unavailable' });
		expect(failed.body).not.toContain('postgres://secret');
		await unavailable.app.close();
	});
});

describe('server boundary: local-only security', () => {
	it('requires a valid bearer token on vault operations', async () => {
		const { app } = makeApp();
		const missing = await app.inject({
			method: 'GET',
			url: `/vaults/${TEST_VAULT_ID}/status`,
			headers: { host: `127.0.0.1:${PORT}` },
		});
		expect(missing.statusCode).toBe(401);
		expect(missing.json()).toMatchObject({ code: 'UNAUTHENTICATED' });

		const wrong = await inject(app, {
			method: 'GET',
			url: `/vaults/${TEST_VAULT_ID}/status`,
			headers: { authorization: 'Bearer wrong-token-0123456789abcdef0123456789' },
		});
		expect(wrong.statusCode).toBe(401);

		const ok = await inject(app, {
			method: 'GET',
			url: `/vaults/${TEST_VAULT_ID}/status`,
		});
		expect(ok.statusCode).toBe(200);
		await app.close();
	});

	it('rejects foreign Host headers', async () => {
		const { app } = makeApp();
		for (const host of ['evil.example:7787', '127.0.0.1:9999', '[::1]:7787']) {
			const response = await inject(app, {
				method: 'GET',
				url: '/healthz',
				headers: { host },
			});
			expect(response.statusCode, host).toBe(403);
			expect(response.json()).toMatchObject({ code: 'FORBIDDEN' });
		}
		await app.close();
	});

	it('rejects disallowed and malformed origins', async () => {
		const { app } = makeApp();
		for (const origin of ['http://evil.example', 'null', 'not-an-origin']) {
			const response = await inject(app, {
				method: 'GET',
				url: '/healthz',
				headers: { origin },
			});
			expect(response.statusCode, origin).toBe(403);
		}

		const allowed = await inject(app, {
			method: 'GET',
			url: '/healthz',
			headers: { origin: 'http://127.0.0.1:7787' },
		});
		expect(allowed.statusCode).toBe(200);
		await app.close();
	});

	it('sets no-store and nosniff on responses', async () => {
		const { app } = makeApp();
		const response = await inject(app, { method: 'GET', url: '/healthz' });
		expect(response.headers['cache-control']).toBe('no-store');
		expect(response.headers['x-content-type-options']).toBe('nosniff');
		await app.close();
	});
});

describe('server boundary: vault routes', () => {
	it('initializes, reports status, locks, and unlocks', async () => {
		const { app } = makeApp();

		const initialized = await inject(app, {
			method: 'POST',
			url: '/vaults',
			payload: { passphrase: 'a passphrase' },
		});
		expect(initialized.statusCode).toBe(201);
		expect(initialized.json()).toEqual({
			vaultId: TEST_VAULT_ID,
			status: 'unlocked',
		});

		const status = await inject(app, {
			method: 'GET',
			url: `/vaults/${TEST_VAULT_ID}/status`,
		});
		expect(status.statusCode).toBe(200);
		expect(status.json()).toEqual({ status: 'unlocked', vaultId: TEST_VAULT_ID });

		const locked = await inject(app, {
			method: 'POST',
			url: `/vaults/${TEST_VAULT_ID}/lock`,
		});
		expect(locked.statusCode).toBe(200);
		expect(locked.json()).toEqual({ vaultId: TEST_VAULT_ID, status: 'locked' });

		const unlocked = await inject(app, {
			method: 'POST',
			url: `/vaults/${TEST_VAULT_ID}/unlock`,
			payload: { passphrase: TEST_CORRECT_PASSPHRASE },
		});
		expect(unlocked.statusCode).toBe(200);
		expect(unlocked.json()).toEqual({ vaultId: TEST_VAULT_ID, status: 'unlocked' });
		await app.close();
	});

	it('rejects invalid bodies and paths with safe validation details', async () => {
		const { app } = makeApp();
		const marker = 'SUBMITTED_PASSPHRASE_MARKER';

		const missing = await inject(app, { method: 'POST', url: '/vaults', payload: {} });
		expect(missing.statusCode).toBe(400);
		const body = missing.json() as {
			code: string;
			details?: Array<{ path: string; message: string }>;
		};
		expect(body.code).toBe('VALIDATION_ERROR');
		expect(body.details?.some((detail) => detail.path === 'passphrase')).toBe(true);
		expect(missing.body).not.toContain(marker);

		const unknown = await inject(app, {
			method: 'POST',
			url: '/vaults',
			payload: { passphrase: marker, unexpected: true },
		});
		expect(unknown.statusCode).toBe(400);
		expect(unknown.body).not.toContain(marker);

		const badPath = await inject(app, {
			method: 'GET',
			url: '/vaults/not-a-uuid/status',
		});
		expect(badPath.statusCode).toBe(400);
		expect(badPath.body).toContain('vaultId');
		await app.close();
	});

	it('maps domain errors to stable status codes', async () => {
		const { app, fake } = makeApp();

		fake.container.initializeVault.execute = async () => {
			throw new VaultAlreadyInitializedError();
		};
		const conflict = await inject(app, {
			method: 'POST',
			url: '/vaults',
			payload: { passphrase: 'pw' },
		});
		expect(conflict.statusCode).toBe(409);
		expect(conflict.json()).toMatchObject({ code: 'CONFLICT' });

		fake.container.getVaultStatus.execute = async () => {
			throw new VaultLockedError();
		};
		const locked = await inject(app, {
			method: 'GET',
			url: `/vaults/${TEST_VAULT_ID}/status`,
		});
		expect(locked.statusCode).toBe(423);
		expect(locked.json()).toMatchObject({ code: 'VAULT_LOCKED' });

		fake.container.listCredentials.execute = async () => {
			throw new PersistenceError('failed to list credentials', {
				cause: new Error('relation "vault_records" does not exist'),
			});
		};
		const failure = await inject(app, {
			method: 'GET',
			url: `/vaults/${TEST_VAULT_ID}/credentials`,
		});
		expect(failure.statusCode).toBe(500);
		expect(failure.json()).toMatchObject({ code: 'INTERNAL_ERROR' });
		expect(failure.body).not.toContain('vault_records');
		await app.close();
	});

	it('returns a stable envelope for unknown routes', async () => {
		const { app } = makeApp();
		const response = await inject(app, { method: 'GET', url: '/does-not-exist' });
		expect(response.statusCode).toBe(404);
		expect(response.json()).toMatchObject({
			code: 'NOT_FOUND',
			message: expect.any(String),
			requestId: expect.any(String),
		});
		await app.close();
	});

	it('echoes a valid request id and replaces an invalid one', async () => {
		const { app } = makeApp();
		const echoed = await inject(app, {
			method: 'GET',
			url: '/does-not-exist',
			headers: { 'x-request-id': 'client-request-123' },
		});
		expect((echoed.json() as { requestId: string }).requestId).toBe('client-request-123');

		const oversized = 'x'.repeat(200);
		const replaced = await inject(app, {
			method: 'GET',
			url: '/does-not-exist',
			headers: { 'x-request-id': oversized },
		});
		const requestId = (replaced.json() as { requestId: string }).requestId;
		expect(requestId).not.toBe(oversized);
		expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
		await app.close();
	});

	it('rejects oversized bodies with 413 before reaching the use case', async () => {
		const { app, fake } = makeApp({ bodyLimitBytes: 512 });
		const response = await inject(app, {
			method: 'POST',
			url: '/vaults',
			payload: { passphrase: 'x'.repeat(2_000) },
		});
		expect(response.statusCode).toBe(413);
		expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
		expect(fake.state.calls.initialize).toBe(0);
		await app.close();
	});

	it('throttles repeated failed unlocks with 429', async () => {
		let now = 1_000;
		const throttle = new UnlockThrottle(
			{ maxFailures: 2, windowMs: 60_000, lockoutMs: 60_000 },
			() => now,
		);
		const { app } = makeApp({ unlockThrottle: throttle });
		await inject(app, {
			method: 'POST',
			url: '/vaults',
			payload: { passphrase: TEST_CORRECT_PASSPHRASE },
		});
		await inject(app, { method: 'POST', url: `/vaults/${TEST_VAULT_ID}/lock` });

		for (let attempt = 0; attempt < 2; attempt += 1) {
			const failed = await inject(app, {
				method: 'POST',
				url: `/vaults/${TEST_VAULT_ID}/unlock`,
				payload: { passphrase: TEST_WRONG_PASSPHRASE },
			});
			expect(failed.statusCode).toBe(401);
		}

		const blocked = await inject(app, {
			method: 'POST',
			url: `/vaults/${TEST_VAULT_ID}/unlock`,
			payload: { passphrase: TEST_CORRECT_PASSPHRASE },
		});
		expect(blocked.statusCode).toBe(429);
		expect(blocked.json()).toMatchObject({ code: 'RATE_LIMITED' });
		expect(blocked.headers['retry-after']).toBeDefined();

		now += 60_001;
		const recovered = await inject(app, {
			method: 'POST',
			url: `/vaults/${TEST_VAULT_ID}/unlock`,
			payload: { passphrase: TEST_CORRECT_PASSPHRASE },
		});
		expect(recovered.statusCode).toBe(200);
		await app.close();
	});
});

describe('server boundary: credential routes and secret handling', () => {
	async function initializedApp() {
		const made = makeApp();
		await inject(made.app, {
			method: 'POST',
			url: '/vaults',
			payload: { passphrase: TEST_CORRECT_PASSPHRASE },
		});
		return made;
	}

	it('runs create/list/detail/update/delete without leaking secrets', async () => {
		const { app } = await initializedApp();
		const created = await inject(app, {
			method: 'POST',
			url: `/vaults/${TEST_VAULT_ID}/credentials`,
			payload: {
				payload: {
					type: 'password',
					name: 'GitHub',
					secret: TEST_SECRET_MARKER,
					notes: TEST_NOTE_MARKER,
					tags: ['work'],
				},
			},
		});
		expect(created.statusCode).toBe(201);
		expect(created.body).not.toContain(TEST_SECRET_MARKER);
		expect(created.body).not.toContain(TEST_NOTE_MARKER);
		expect(created.json()).toMatchObject({ id: CREDENTIAL_ID, name: 'GitHub', tags: ['work'] });

		const list = await inject(app, {
			method: 'GET',
			url: `/vaults/${TEST_VAULT_ID}/credentials?limit=10`,
		});
		expect(list.statusCode).toBe(200);
		expect(list.body).not.toContain(TEST_SECRET_MARKER);
		expect(list.body).not.toContain(TEST_NOTE_MARKER);
		expect((list.json() as { items: unknown[] }).items).toHaveLength(1);

		const detail = await inject(app, {
			method: 'GET',
			url: `/vaults/${TEST_VAULT_ID}/credentials/${CREDENTIAL_ID}`,
		});
		expect(detail.statusCode).toBe(200);
		expect(detail.json()).toMatchObject({
			id: CREDENTIAL_ID,
			payload: { secret: TEST_SECRET_MARKER, notes: TEST_NOTE_MARKER },
		});

		const updated = await inject(app, {
			method: 'PUT',
			url: `/vaults/${TEST_VAULT_ID}/credentials/${CREDENTIAL_ID}`,
			payload: {
				payload: {
					type: 'password',
					name: 'GitHub',
					secret: 'UPDATED_SECRET_MARKER_9z9z',
				},
			},
		});
		expect(updated.statusCode).toBe(200);
		expect(updated.body).not.toContain('UPDATED_SECRET_MARKER_9z9z');
		expect(updated.json()).toEqual({ id: CREDENTIAL_ID, updatedAt: expect.any(String) });

		const deleted = await inject(app, {
			method: 'DELETE',
			url: `/vaults/${TEST_VAULT_ID}/credentials/${CREDENTIAL_ID}`,
		});
		expect(deleted.statusCode).toBe(200);
		expect(deleted.json()).toEqual({ id: CREDENTIAL_ID, deleted: true });

		const missing = await inject(app, {
			method: 'GET',
			url: `/vaults/${TEST_VAULT_ID}/credentials/${CREDENTIAL_ID}`,
		});
		expect(missing.statusCode).toBe(404);
		expect(missing.json()).toMatchObject({ code: 'NOT_FOUND' });
		await app.close();
	});

	it('validates list pagination and credential bodies', async () => {
		const { app } = await initializedApp();
		const badLimit = await inject(app, {
			method: 'GET',
			url: `/vaults/${TEST_VAULT_ID}/credentials?limit=1000`,
		});
		expect(badLimit.statusCode).toBe(400);

		const badCredential = await inject(app, {
			method: 'POST',
			url: `/vaults/${TEST_VAULT_ID}/credentials`,
			payload: { payload: { type: 'password', name: '', secret: 's' } },
		});
		expect(badCredential.statusCode).toBe(400);
		expect(badCredential.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
		await app.close();
	});

	it('never writes passphrases or secrets to logs', async () => {
		const chunks: string[] = [];
		const stream = new Writable({
			write(chunk, _encoding, callback) {
				chunks.push(String(chunk));
				callback();
			},
		});
		const { app, fake } = makeApp({ logger: { level: 'info', stream } });

		await inject(app, {
			method: 'POST',
			url: '/vaults',
			payload: { passphrase: 'LOGGED_PASSPHRASE_MARKER' },
		});
		await inject(app, {
			method: 'POST',
			url: `/vaults/${TEST_VAULT_ID}/credentials`,
			payload: {
				payload: {
					type: 'password',
					name: 'logged',
					secret: 'LOGGED_SECRET_MARKER',
					notes: 'LOGGED_NOTE_MARKER',
				},
			},
		});
		fake.container.listCredentials.execute = async () => {
			throw new PersistenceError('failed to list credentials', {
				cause: new Error('SQL: select * from vault_records'),
			});
		};
		await inject(app, {
			method: 'GET',
			url: `/vaults/${TEST_VAULT_ID}/credentials`,
		});
		await app.close();

		const logs = chunks.join('\n');
		expect(logs).not.toContain('LOGGED_PASSPHRASE_MARKER');
		expect(logs).not.toContain('LOGGED_SECRET_MARKER');
		expect(logs).not.toContain('LOGGED_NOTE_MARKER');
		expect(logs).not.toContain('select * from vault_records');
	});
});
