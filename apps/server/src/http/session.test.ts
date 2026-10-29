import { describe, expect, it } from 'vitest';

import {
	buildClearedSessionCookie,
	buildSessionCookie,
	parseSessionCookie,
	SESSION_COOKIE_NAME,
} from './session.js';

const TOKEN = 'a'.repeat(43);

describe('session cookie helpers', () => {
	it('extracts the session value from a cookie header with several entries', () => {
		expect(parseSessionCookie(`theme=dark; ${SESSION_COOKIE_NAME}=${TOKEN}; other=1`)).toBe(TOKEN);
	});

	it('accepts only a bounded, well-formed token value', () => {
		expect(parseSessionCookie(undefined)).toBeNull();
		expect(parseSessionCookie('')).toBeNull();
		expect(parseSessionCookie('theme=dark')).toBeNull();
		expect(parseSessionCookie(`${SESSION_COOKIE_NAME}=short`)).toBeNull();
		expect(parseSessionCookie(`${SESSION_COOKIE_NAME}=${'a'.repeat(40)}!`)).toBeNull();
		expect(parseSessionCookie(`${SESSION_COOKIE_NAME}=${'a'.repeat(513)}`)).toBeNull();
		expect(parseSessionCookie(`x=${'a'.repeat(9_000)}`)).toBeNull();
	});

	it('builds an HttpOnly, SameSite=Strict, host-only session cookie by default', () => {
		const cookie = buildSessionCookie(TOKEN);
		expect(cookie).toContain(`${SESSION_COOKIE_NAME}=${TOKEN}`);
		expect(cookie).toContain('HttpOnly');
		expect(cookie).toContain('SameSite=Strict');
		expect(cookie).toContain('Path=/');
		// No Domain: the cookie is host-only.
		expect(cookie).not.toContain('Domain=');
		// No Max-Age: the browser keeps it in memory for the session only.
		expect(cookie).not.toContain('Max-Age');
	});

	it('adds Max-Age only when a lifetime is requested', () => {
		expect(buildSessionCookie(TOKEN, { maxAgeSeconds: 60 })).toContain('Max-Age=60');
		expect(() => buildSessionCookie(TOKEN, { maxAgeSeconds: 0 })).toThrow(RangeError);
	});

	it('clears the cookie with an expired, HttpOnly value', () => {
		const cookie = buildClearedSessionCookie();
		expect(cookie).toContain(`${SESSION_COOKIE_NAME}=;`);
		expect(cookie).toContain('Max-Age=0');
		expect(cookie).toContain('HttpOnly');
	});
});
