import type { FastifyInstance } from 'fastify';

import { ForbiddenError } from '../errors.js';
import { buildClearedSessionCookie, buildSessionCookie } from '../session.js';
import type { AuthenticateHandler } from './vaults.js';

/**
 * Header the browser client sends when requesting the browser credential.
 *
 * It is **not** an authentication factor. Its only job is to make the handoff
 * a non-simple request: a cross-site `<form>`/`<img>` cannot set a custom
 * header, and a cross-origin script would need a successful CORS preflight that
 * this server never grants. Combined with the global
 * Host/Origin/Sec-Fetch-Site hooks and `SameSite=Strict`, this closes the
 * browser CSRF path to cookie issuance.
 *
 * A non-browser local process can send this header itself and omit `Origin`.
 * The handoff therefore trusts any caller that can reach the loopback listener;
 * loopback does not establish the peer's OS user. See
 * `docs/local-auth-handoff.md` ("Trust boundary").
 */
export const HANDOFF_HEADER = 'x-aegis-handoff';

export interface SessionRouteDeps {
	/** The per-launch token the cookie will carry. */
	readonly apiToken: string;
	readonly authenticate: AuthenticateHandler;
	/** Omit for an in-memory (browser-session) cookie; set to persist. */
	readonly maxAgeSeconds?: number;
}

export function registerSessionRoutes(app: FastifyInstance, deps: SessionRouteDeps): void {
	/**
	 * Install the browser credential. No token appears in the body, URL, or
	 * anywhere JavaScript can read it: only in the `HttpOnly` `Set-Cookie`
	 * response header.
	 *
	 * This route is unauthenticated by design: the server cannot verify the OS
	 * user of a TCP peer, so it trusts any process that can reach the listener.
	 * The header/Fetch-Metadata checks only stop cross-site browser requests.
	 */
	app.post('/auth/session', async (request, reply) => {
		if (request.headers[HANDOFF_HEADER] !== '1') {
			throw new ForbiddenError('handoff header is required');
		}
		if (request.headers['sec-fetch-site'] === 'cross-site') {
			throw new ForbiddenError('cross-site requests are not allowed');
		}

		reply.header(
			'set-cookie',
			buildSessionCookie(
				deps.apiToken,
				deps.maxAgeSeconds !== undefined ? { maxAgeSeconds: deps.maxAgeSeconds } : {},
			),
		);
		return reply.code(204).send();
	});

	/** Probe: lets the UI ask "am I already authenticated?" without the token. */
	app.get('/auth/session', { preHandler: deps.authenticate }, async (_request, reply) => {
		return reply.code(204).send();
	});

	/** Clear the credential. The server token itself remains valid until shutdown. */
	app.delete('/auth/session', async (_request, reply) => {
		reply.header('set-cookie', buildClearedSessionCookie());
		return reply.code(204).send();
	});
}
