import { describe, expect, it } from 'vitest';

import { CURSOR_DECODED_MAX_BYTES, decodeCredentialCursor, encodeCredentialCursor } from './credential-cursor.js';
import { InvalidCursorError } from '../errors/domain-errors.js';

const cursor = {
	createdAt: '2026-01-01T00:00:00.000Z',
	id: '00000000-0000-4000-8000-000000000001',
};

describe('credential cursor', () => {
	it('round-trips', () => {
		expect(decodeCredentialCursor(encodeCredentialCursor(cursor))).toEqual(cursor);
	});

	it('rejects a non-base64url cursor', () => {
		expect(() => decodeCredentialCursor('not valid!!')).toThrow(InvalidCursorError);
	});

	it('rejects an over-long cursor', () => {
		expect(() => decodeCredentialCursor('a'.repeat(513))).toThrow(InvalidCursorError);
	});

	it('rejects a decoded payload that is too large', () => {
		const big = Buffer.from('x'.repeat(CURSOR_DECODED_MAX_BYTES + 1), 'utf8').toString('base64url');
		expect(() => decodeCredentialCursor(big)).toThrow(InvalidCursorError);
	});

	it('rejects a wrong version, bad timestamp, and bad id', () => {
		const encode = (value: unknown) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
		expect(() => decodeCredentialCursor(encode({ v: 2, ...cursor }))).toThrow(InvalidCursorError);
		expect(() =>
			decodeCredentialCursor(encode({ v: 1, createdAt: 'nope', id: cursor.id })),
		).toThrow(InvalidCursorError);
		expect(() =>
			decodeCredentialCursor(encode({ v: 1, createdAt: cursor.createdAt, id: 'nope' })),
		).toThrow(InvalidCursorError);
	});

	it('rejects extra keys and non-object payloads', () => {
		expect(() =>
			decodeCredentialCursor(
				Buffer.from(JSON.stringify({ v: 1, ...cursor, extra: 1 }), 'utf8').toString('base64url'),
			),
		).toThrow(InvalidCursorError);
		expect(() =>
			decodeCredentialCursor(Buffer.from(JSON.stringify([1, 2, 3]), 'utf8').toString('base64url')),
		).toThrow(InvalidCursorError);
	});
});
