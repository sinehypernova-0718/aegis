import { Writable } from 'node:stream';
import type { FastifyInstance, FastifyServerOptions } from 'fastify';
import { describe, expect, it } from 'vitest';

import { buildServer } from './build-server.js';
import { HANDOFF_HEADER } from './routes/session.js';
import { TEST_API_TOKEN, TEST_VAULT_ID, createFakeContainer } from '../testing/fakes.js';

const PORT = 7_787;
const HOST = `127.0.0.1:${PORT}`;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const COOKIE = `aegis_session=${TEST_API_TOKEN}`;

function makeApp(options: { logger?: FastifyServerOptions['logger'] } = {}): FastifyInstance {
	return buildServer({
		container: createFakeContainer().container,
		apiToken: TEST_API_TOKEN,
		port: PORT,
		bodyLimitBytes: 4_096,
		logLevel: 'silent',
		checkReadiness: async () => {},
		...(options.logger !== undefined ? { logger: options.logger } : {}),
	});
}

function handoffRequest(
	app: FastifyInstance,
	headers: Record<string, string> = {},
): Promise<{ statusCode: number; headers: Record<string, unknown>; body: string }> {
	return app.inject({
		method: 'POST',
		url: '/auth/session',
		headers: {
			host: HOST,
			origin: ORIGIN,
			'sec-fetch-site': 'same-origin',
			[HANDOFF_HEADER]: '1',
			...headers,
		},
	});
}

describe('local auth handoff: browser session cookie', () => {
	it('installs an HttpOnly SameSite=Strict cookie and never exposes the token in the body', async () => {
		const app = makeApp();
		const response = await handoffRequest(app);

		expect(response.statusCode).toBe(204);
		expect(response.body).toBe('');
		expect(response.body).not.toContain(TEST_API_TOKEN);

		const setCookie = response.headers['set-cookie'];
		expect(typeof setCookie).toBe('string');
		expect(setCookie).toContain(`aegis_session=${TEST_API_TOKEN}`);
		expect(setCookie).toContain('HttpOnly');
		expect(setCookie).toContain('SameSite=Strict');
		expect(setCookie).toContain('Path=/');
		expect(setCookie).not.toContain('Domain=');
		// Session cookie: nothing is persisted to browser storage or disk.
		expect(setCookie).not.toContain('Max-Age');
		expect(response.headers['cache-control']).toBe('no-store');
		await app.close();
	});

	it('rejects handoffs that lack the non-simple request header', async () => {
		const app = makeApp();
		const response = await app.inject({
			method: 'POST',
			url: '/auth/session',
			headers: { host: HOST, origin: ORIGIN, 'sec-fetch-site': 'same-origin' },
		});
		expect(response.statusCode).toBe(403);
		expect(response.headers['set-cookie']).toBeUndefined();
		await app.close();
	});

	it('rejects cross-site handoff attempts without issuing a cookie', async () => {
		const app = makeApp();
		const response = await handoffRequest(app, { 'sec-fetch-site': 'cross-site' });
		expect(response.statusCode).toBe(403);
		expect(response.headers['set-cookie']).toBeUndefined();
		await app.close();
	});

	it('rejects handoffs from a foreign origin', async () => {
		const app = makeApp();
		const response = await handoffRequest(app, { origin: 'http://evil.example' });
		expect(response.statusCode).toBe(403);
		expect(response.headers['set-cookie']).toBeUndefined();
		await app.close();
	});

	it('documents the trust model: a non-browser local caller can hand off', async () => {
		const app = makeApp();
		// No Origin and no browser Fetch Metadata: exactly what a local process
		// can send. This is the documented boundary - any process that can reach
		// the loopback listener is trusted to attempt authentication. It is NOT
		// an OS-user boundary; see docs/local-auth-handoff.md ("Trust boundary").
		const response = await app.inject({
			method: 'POST',
			url: '/auth/session',
			headers: { host: HOST, [HANDOFF_HEADER]: '1' },
		});
		expect(response.statusCode).toBe(204);
		expect(response.headers['set-cookie']).toContain(`aegis_session=${TEST_API_TOKEN}`);
		await app.close();
	});

	it('authenticates ordinary API requests from the cookie alone', async () => {
		const app = makeApp();
		const response = await app.inject({
			method: 'GET',
			url: `/vaults/${TEST_VAULT_ID}/status`,
			headers: { host: HOST, cookie: COOKIE },
		});
		// 200 (not 401) proves the cookie authenticated the request; the fake
		// container simply has no vault yet.
		expect(response.statusCode).toBe(200);
		expect(response.json()).toMatchObject({ status: 'uninitialized' });
		await app.close();
	});

	it('still accepts the non-browser bearer header', async () => {
		const app = makeApp();
		const response = await app.inject({
			method: 'GET',
			url: `/vaults/${TEST_VAULT_ID}/status`,
			headers: { host: HOST, authorization: `Bearer ${TEST_API_TOKEN}` },
		});
		expect(response.statusCode).toBe(200);
		await app.close();
	});

	it('rejects an absent or wrong cookie', async () => {
		const app = makeApp();
		const missing = await app.inject({
			method: 'GET',
			url: `/vaults/${TEST_VAULT_ID}/status`,
			headers: { host: HOST },
		});
		expect(missing.statusCode).toBe(401);

		const wrong = await app.inject({
			method: 'GET',
			url: `/vaults/${TEST_VAULT_ID}/status`,
			headers: { host: HOST, cookie: `aegis_session=${'b'.repeat(43)}` },
		});
		expect(wrong.statusCode).toBe(401);
		await app.close();
	});

	it('rejects ambiguous duplicate session cookies at the auth boundary', async () => {
		const app = makeApp();
		const response = await app.inject({
			method: 'GET',
			url: `/vaults/${TEST_VAULT_ID}/status`,
			headers: {
				host: HOST,
				cookie: `aegis_session=${TEST_API_TOKEN}; aegis_session=${TEST_API_TOKEN}`,
			},
		});
		expect(response.statusCode).toBe(401);
		await app.close();
	});

	it('probes the session without the token and clears it on sign-out', async () => {
		const app = makeApp();
		const authenticated = await app.inject({
			method: 'GET',
			url: '/auth/session',
			headers: { host: HOST, cookie: COOKIE },
		});
		expect(authenticated.statusCode).toBe(204);

		const anonymous = await app.inject({
			method: 'GET',
			url: '/auth/session',
			headers: { host: HOST },
		});
		expect(anonymous.statusCode).toBe(401);

		const cleared = await app.inject({
			method: 'DELETE',
			url: '/auth/session',
			headers: { host: HOST, cookie: COOKIE },
		});
		expect(cleared.statusCode).toBe(204);
		expect(cleared.headers['set-cookie']).toContain('Max-Age=0');
		await app.close();
	});

	it('never writes the token to the request/response log', async () => {
		const chunks: string[] = [];
		const stream = new Writable({
			write(chunk, _encoding, callback) {
				chunks.push(String(chunk));
				callback();
			},
		});
		const app = makeApp({ logger: { level: 'trace', stream } });

		await handoffRequest(app);
		await app.inject({
			method: 'GET',
			url: `/vaults/${TEST_VAULT_ID}/status`,
			headers: { host: HOST, cookie: COOKIE },
		});
		await app.close();

		const logs = chunks.join('\n');
		expect(logs).not.toContain(TEST_API_TOKEN);
	});
});
