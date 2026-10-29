import { describe, expect, it } from 'vitest';

import {
	CREDENTIAL_MAX_TAGS,
	parseCredentialPayload,
	serializeCredentialPayload,
	validateCredentialPayload,
} from './credential-payload.js';
import { InvalidCredentialPayloadError } from '../errors/domain-errors.js';

const base = {
	type: 'password' as const,
	name: 'GitHub',
	secret: 'TEST_SECRET_MARKER_7c91',
};

describe('credential payload', () => {
	it('stamps the payload schema version', () => {
		const payload = validateCredentialPayload(base);
		expect(payload.schemaVersion).toBe(1);
		expect(payload.tags).toEqual([]);
	});

	it('rejects missing required fields', () => {
		expect(() => validateCredentialPayload({ type: 'password', name: 'x' })).toThrow(
			InvalidCredentialPayloadError,
		);
		expect(() => validateCredentialPayload({ type: 'password', secret: 'x' })).toThrow(
			InvalidCredentialPayloadError,
		);
	});

	it('rejects unknown keys, unknown kinds, and blank names', () => {
		expect(() => validateCredentialPayload({ ...base, extra: 1 })).toThrow(
			InvalidCredentialPayloadError,
		);
		expect(() => validateCredentialPayload({ ...base, type: 'nope' })).toThrow(
			InvalidCredentialPayloadError,
		);
		expect(() => validateCredentialPayload({ ...base, name: '   ' })).toThrow(
			InvalidCredentialPayloadError,
		);
	});

	it('rejects an invalid expiresAt', () => {
		expect(() => validateCredentialPayload({ ...base, expiresAt: '2026-01-01' })).toThrow(
			InvalidCredentialPayloadError,
		);
	});

	it('dedupes exact duplicate tags before applying the count bound', () => {
		const payload = validateCredentialPayload({ ...base, tags: ['a', 'b', 'a', 'b'] });
		expect(payload.tags).toEqual(['a', 'b']);
	});

	it('rejects more than the maximum number of distinct tags', () => {
		const tags = Array.from({ length: CREDENTIAL_MAX_TAGS + 1 }, (_, i) => `tag-${i}`);
		expect(() => validateCredentialPayload({ ...base, tags })).toThrow(
			InvalidCredentialPayloadError,
		);
	});

	it('round-trips through canonical serialization', () => {
		const payload = validateCredentialPayload({
			...base,
			username: 'user@example.com',
			url: 'https://example.com',
			notes: 'TEST_PRIVATE_NOTE_MARKER_4d28',
			tags: ['TEST_TAG_MARKER_8b35'],
		});
		const bytes = serializeCredentialPayload(payload);
		const parsed = parseCredentialPayload(bytes);
		expect(parsed).toEqual(payload);
	});

	it('omits absent optional keys from the serialized bytes', () => {
		const bytes = serializeCredentialPayload(validateCredentialPayload(base));
		const text = new TextDecoder().decode(bytes);
		expect(text).not.toContain('username');
		expect(text).not.toContain('notes');
		expect(text).toContain('tags');
	});

	it('rejects a secret that exceeds the field bound', () => {
		expect(() =>
			validateCredentialPayload({ ...base, secret: 'x'.repeat(32_769) }),
		).toThrow(InvalidCredentialPayloadError);
	});

	it('rejects a decrypted payload that is not valid JSON', () => {
		expect(() => parseCredentialPayload(new TextEncoder().encode('not json'))).toThrow(
			InvalidCredentialPayloadError,
		);
	});
});
