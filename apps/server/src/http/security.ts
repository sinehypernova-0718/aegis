import type { FastifyInstance } from 'fastify';
import { ForbiddenError } from './errors.js';

const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost']);

export interface SecurityConfig {
	readonly port: number;
	readonly allowedOrigins: readonly string[];
}

interface ParsedHost {
	readonly hostname: string;
	readonly port: string;
}

function parseHostHeader(value: string): ParsedHost | null {
	let url: URL;
	try {
		url = new URL(`http://${value}`);
	} catch {
		return null;
	}
	// Reject userinfo, paths, queries, and fragments smuggled into Host.
	if (
		url.username !== '' ||
		url.password !== '' ||
		url.pathname !== '/' ||
		url.search !== '' ||
		url.hash !== ''
	) {
		return null;
	}
	return { hostname: url.hostname, port: url.port };
}

/** A Host header is valid only for a loopback hostname on the expected port. */
export function isAllowedHost(value: string | undefined, port: number): boolean {
	const header = typeof value === 'string' ? value.trim() : '';
	if (header === '') return false;
	const parsed = parseHostHeader(header);
	if (!parsed) return false;
	return LOOPBACK_HOSTNAMES.has(parsed.hostname) && parsed.port === String(port);
}

/** Origins are matched exactly; there is no wildcard or prefix matching. */
export function isAllowedOrigin(origin: string, allowedOrigins: readonly string[]): boolean {
	return allowedOrigins.includes(origin);
}

/**
 * Enforce the local-only boundary on every request:
 *  - reject non-loopback / wrong-port `Host` values (DNS rebinding),
 *  - reject unexpected/malformed `Origin` values (cross-origin browser calls),
 *  - reject `Sec-Fetch-Site: cross-site` as defense in depth.
 *
 * Bearer authentication is enforced separately on vault routes. Host/Origin
 * checks are not a substitute for that authentication.
 */
export function registerSecurityHooks(app: FastifyInstance, config: SecurityConfig): void {
	app.addHook('onRequest', async (request) => {
		if (!isAllowedHost(request.headers.host, config.port)) {
			throw new ForbiddenError('host is not allowed');
		}

		const origin = request.headers.origin;
		if (origin !== undefined && !isAllowedOrigin(origin, config.allowedOrigins)) {
			throw new ForbiddenError('origin is not allowed');
		}

		const fetchSite = request.headers['sec-fetch-site'];
		if (typeof fetchSite === 'string' && fetchSite === 'cross-site') {
			throw new ForbiddenError('cross-site requests are not allowed');
		}
	});
}

/** Apply conservative response headers to every response. */
export function registerSecurityHeaders(app: FastifyInstance): void {
	app.addHook('onSend', async (_request, reply, payload) => {
		reply.header('cache-control', 'no-store');
		reply.header('x-content-type-options', 'nosniff');
		return payload;
	});
}
