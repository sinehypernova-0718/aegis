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
 * `Secure` is intentionally absent: Aegis serves plain HTTP on `127.0.0.1`.
 * This is an explicit local-HTTP limitation: the cookie has no transport
 * confidentiality or integrity. The `Host`/`Origin` checks validate request
 * metadata; they are not a substitute for TLS. Browser support for `Secure` on
 * loopback is inconsistent (Chrome/Firefox accept it on `localhost`, Safari
 * does not, and `127.0.0.1` is not consistently documented), so adding it
 * unconditionally would silently drop the cookie for some users. See
 * `docs/local-auth-handoff.md` ("Local HTTP limitation").
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
 * Returns `null` when the header is missing, oversized, or malformed, when the
 * value is not a valid token shape, or when more than one `aegis_session` entry
 * is present. Duplicate session entries are rejected outright rather than
 * resolved by position: an ambiguous cookie header must not authenticate.
 * Unrelated cookie names are ignored. Parsing is linear and never throws, so it
 * is safe to call on untrusted input.
 */
export function parseSessionCookie(cookieHeader: string | undefined): string | null {
	if (typeof cookieHeader !== 'string') return null;
	if (cookieHeader.length === 0 || cookieHeader.length > MAX_COOKIE_HEADER_LENGTH) return null;

	let sessionValue: string | null = null;
	let seenSessionEntry = false;

	for (const pair of cookieHeader.split(';')) {
		const separator = pair.indexOf('=');
		// A bare name (no `=`) can still be a session entry, and therefore a
		// duplicate; treat the whole trimmed pair as the name in that case.
		const name = separator === -1 ? pair.trim() : pair.slice(0, separator).trim();
		if (name !== SESSION_COOKIE_NAME) continue;

		// Reject a second occurrence even when the first was well-formed and
		// even when the duplicate itself is malformed.
		if (seenSessionEntry) return null;
		seenSessionEntry = true;

		// A session entry without a value is malformed.
		if (separator === -1) return null;
		const value = pair.slice(separator + 1).trim();
		if (!SESSION_VALUE_PATTERN.test(value)) return null;
		sessionValue = value;
	}

	return sessionValue;
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
