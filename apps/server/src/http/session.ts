/**
 * Browser session-cookie handoff for the local API token.
 *
 * A browser cannot read the per-launch token file, and handing the token to
 * page JavaScript (localStorage, a URL, or a log line) would leak a long-lived
 * credential to any injected script. Instead the trusted local server installs
 * the token as an `HttpOnly` cookie: the browser attaches it automatically on
 * same-origin requests, but page scripts can never read it.
 *
 * The cookie is a *session* cookie by default (no `Max-Age`/`Expires`), so the
 * browser keeps it in memory and drops it when the browser session ends. It is
 * host-only (no `Domain`), so it is never sent to a sibling hostname.
 *
 * `Secure` is intentionally absent: Aegis binds plain HTTP on loopback, so a
 * `Secure` cookie would never be sent. Loopback traffic does not cross a
 * network boundary; the `Host`/`Origin` checks in `security.ts` are the
 * equivalent transport guard.
 *
 * The handoff is not an OS-user boundary. Loopback is shared by local users,
 * and a non-browser process can reproduce the browser request. See
 * `docs/local-auth-handoff.md` ("Trust boundary").
 */

/** Name of the browser credential. Deliberately does not look like the bearer token. */
export const SESSION_COOKIE_NAME = 'aegis_session';

/** Same shape the bearer authenticator accepts: bounded, base64url, no separators. */
const SESSION_VALUE_PATTERN = /^[A-Za-z0-9_-]{32,512}$/;

/** Bound attacker-controlled `Cookie` input before scanning it. */
const MAX_COOKIE_HEADER_LENGTH = 8_192;

/**
 * Extract the Aegis session value from a `Cookie` header.
 *
 * Returns `null` for a missing, oversized, malformed, or duplicate-free header
 * whose value is not a valid token shape. Parsing is linear and never throws so
 * it is safe to call on untrusted input.
 */
export function parseSessionCookie(cookieHeader: string | undefined): string | null {
	if (typeof cookieHeader !== 'string') return null;
	if (cookieHeader.length === 0 || cookieHeader.length > MAX_COOKIE_HEADER_LENGTH) return null;

	for (const pair of cookieHeader.split(';')) {
		const separator = pair.indexOf('=');
		if (separator === -1) continue;
		if (pair.slice(0, separator).trim() !== SESSION_COOKIE_NAME) continue;
		const value = pair.slice(separator + 1).trim();
		return SESSION_VALUE_PATTERN.test(value) ? value : null;
	}

	return null;
}

export interface SessionCookieOptions {
	/**
	 * When supplied, the browser persists the cookie for this many seconds.
	 * Omit it for the default in-memory session cookie, which is discarded when
	 * the browser session ends.
	 */
	readonly maxAgeSeconds?: number;
}

/** Serialize the `Set-Cookie` value that installs the browser credential. */
export function buildSessionCookie(token: string, options: SessionCookieOptions = {}): string {
	const parts = [`${SESSION_COOKIE_NAME}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Strict'];
	if (options.maxAgeSeconds !== undefined) {
		if (!Number.isInteger(options.maxAgeSeconds) || options.maxAgeSeconds < 1) {
			throw new RangeError('maxAgeSeconds must be a positive integer');
		}
		parts.push(`Max-Age=${options.maxAgeSeconds}`);
	}
	return parts.join('; ');
}

/** Serialize the `Set-Cookie` value that removes the browser credential. */
export function buildClearedSessionCookie(): string {
	return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}
