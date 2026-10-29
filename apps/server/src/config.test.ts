import { describe, expect, it } from 'vitest';

import { LOOPBACK_HOST, readServerConfig } from './config.js';

const BASE_ENV = { DATABASE_URL: 'postgres://user:pass@localhost:5432/aegis' };

describe('server config', () => {
	it('defaults to loopback, five-minute idle lock, and no token file', () => {
		const config = readServerConfig({ ...BASE_ENV });
		expect(config.host).toBe(LOOPBACK_HOST);
		expect(config.port).toBe(7_787);
		expect(config.idleTimeoutMs).toBe(300_000);
		expect(config.shutdownForceTimeoutMs).toBe(2_000);
		expect(config.apiToken).toBeNull();
		// The browser receives the generated token over the HttpOnly cookie
		// handoff, so no secret is written to disk unless explicitly requested.
		expect(config.tokenFile).toBeNull();
		expect(config.allowedOrigins).toEqual(['http://127.0.0.1:7787', 'http://localhost:7787']);
	});

	it('publishes a generated token to a file only when explicitly configured', () => {
		const config = readServerConfig({
			...BASE_ENV,
			AEGIS_TOKEN_FILE: '/run/aegis/server.token',
		});
		expect(config.apiToken).toBeNull();
		expect(config.tokenFile).toBe('/run/aegis/server.token');
	});

	it('accepts a base64url token and disables the handoff file', () => {
		const token = 'a'.repeat(43);
		const config = readServerConfig({
			...BASE_ENV,
			AEGIS_API_TOKEN: token,
			AEGIS_TOKEN_FILE: '/run/aegis/server.token',
		});
		expect(config.apiToken).toBe(token);
		expect(config.tokenFile).toBeNull();
	});

	it('rejects short or non-base64url tokens', () => {
		expect(() => readServerConfig({ ...BASE_ENV, AEGIS_API_TOKEN: 'short' })).toThrow();
		expect(() =>
			readServerConfig({ ...BASE_ENV, AEGIS_API_TOKEN: `${'a'.repeat(40)}!` }),
		).toThrow();
	});

	it('rejects missing database configuration', () => {
		expect(() => readServerConfig({})).toThrow();
	});

	it('accepts exact extra origins only', () => {
		const config = readServerConfig({
			...BASE_ENV,
			AEGIS_ALLOWED_ORIGINS: 'http://127.0.0.1:5173',
		});
		expect(config.allowedOrigins).toContain('http://127.0.0.1:5173');
		expect(() =>
			readServerConfig({
				...BASE_ENV,
				AEGIS_ALLOWED_ORIGINS: 'http://127.0.0.1:5173/path',
			}),
		).toThrow();
		expect(() =>
			readServerConfig({ ...BASE_ENV, AEGIS_ALLOWED_ORIGINS: 'ftp://127.0.0.1:5173' }),
		).toThrow();
	});

	it('validates numeric bounds', () => {
		expect(() => readServerConfig({ ...BASE_ENV, AEGIS_PORT: '0' })).toThrow();
		expect(() => readServerConfig({ ...BASE_ENV, AEGIS_IDLE_TIMEOUT_MS: '-1' })).toThrow();
	});
});
