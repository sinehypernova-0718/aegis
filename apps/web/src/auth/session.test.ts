import { describe, expect, it } from 'vitest';

import { SessionClient, SessionHandoffError } from './session.js';

interface RecordedCall {
	readonly url: string;
	readonly init: RequestInit;
}

function recordingFetch(response: Response | (() => Response)): {
	fetch: typeof fetch;
	calls: RecordedCall[];
} {
	const calls: RecordedCall[] = [];
	const fake = (async (input: RequestInfo | URL, init?: RequestInit) => {
		calls.push({ url: String(input), init: init ?? {} });
		return typeof response === 'function' ? response() : response;
	}) as typeof fetch;
	return { fetch: fake, calls };
}

describe('SessionClient', () => {
	it('establishes the handoff with credentials and the non-simple header only', async () => {
		const { fetch, calls } = recordingFetch(new Response(null, { status: 204 }));
		const client = new SessionClient({ fetch });

		await client.establish();

		expect(calls).toHaveLength(1);
		const [call] = calls;
		expect(call?.url).toBe('/auth/session');
		expect(call?.init.method).toBe('POST');
		expect(call?.init.credentials).toBe('same-origin');
		expect(call?.init.headers).toMatchObject({ 'x-aegis-handoff': '1' });
		// No token is placed in the URL, the request body, or an Authorization header.
		expect(call?.url).not.toMatch(/token|bearer/i);
		expect(call?.init.body).toBeUndefined();
		expect(call?.init.headers).not.toHaveProperty('authorization');
	});

	it('reports an established session without reading any credential', async () => {
		const established = recordingFetch(new Response(null, { status: 204 }));
		await expect(new SessionClient({ fetch: established.fetch }).hasSession()).resolves.toBe(true);

		const anonymous = recordingFetch(new Response(null, { status: 401 }));
		await expect(new SessionClient({ fetch: anonymous.fetch }).hasSession()).resolves.toBe(false);
	});

	it('clears the session with DELETE', async () => {
		const { fetch, calls } = recordingFetch(new Response(null, { status: 204 }));
		await new SessionClient({ fetch }).clear();
		expect(calls[0]?.url).toBe('/auth/session');
		expect(calls[0]?.init.method).toBe('DELETE');
		expect(calls[0]?.init.credentials).toBe('same-origin');
	});

	it('sends ordinary API requests same-origin without an Authorization header', async () => {
		const { fetch, calls } = recordingFetch(new Response('{}', { status: 200 }));
		const client = new SessionClient({ fetch });

		const response = await client.request('/vaults/abc/status', { method: 'GET' });

		expect(response.status).toBe(200);
		expect(calls[0]?.url).toBe('/vaults/abc/status');
		expect(calls[0]?.init.credentials).toBe('same-origin');
		expect(calls[0]?.init.headers).toBeUndefined();
	});

	it('joins an explicit base URL without a double slash', async () => {
		const { fetch, calls } = recordingFetch(new Response(null, { status: 204 }));
		const client = new SessionClient({ baseUrl: 'http://127.0.0.1:7787/', fetch });
		await client.establish();
		expect(calls[0]?.url).toBe('http://127.0.0.1:7787/auth/session');
	});

	it('surfaces server failures and unreachable servers as typed errors', async () => {
		const failing = recordingFetch(new Response(null, { status: 403 }));
		await expect(new SessionClient({ fetch: failing.fetch }).establish()).rejects.toMatchObject({
			name: 'SessionHandoffError',
			status: 403,
		});

		const unreachable = (async () => {
			throw new Error('ECONNREFUSED');
		}) as typeof fetch;
		const error = await new SessionClient({ fetch: unreachable })
			.establish()
			.catch((cause) => cause);
		expect(error).toBeInstanceOf(SessionHandoffError);
		expect(error.status).toBe(0);
		expect(String(error.message)).not.toContain('ECONNREFUSED');
	});
});
