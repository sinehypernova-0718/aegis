import type { FastifyInstance } from 'fastify';

import { ForbiddenError } from '../errors.js';
import { buildClearedSessionCookie, buildSessionCookie } from '../session.js';
import type { AuthenticateHandler } from './vaults.js';

/**
 * Header the trusted UI sends when requesting the browser credential.
 *
 * It is not a secret. Its job is to make the handoff a non-simple request: a
 * cross-site `<form>`/`<img>` cannot set a custom header, and a cross-origin
 * script would need a successful CORS preflight that this server never grants.
 * Combined with the global Host/Origin/Sec-Fetch-Site hooks and
 * `SameSite=Strict`, this closes the CSRF path to cookie issuance.
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
