import {
	CREDENTIAL_MAX_TAGS,
	CREDENTIAL_NAME_MAX_LENGTH,
	CREDENTIAL_NOTES_MAX_LENGTH,
	CREDENTIAL_SECRET_MAX_LENGTH,
	CREDENTIAL_TAG_MAX_LENGTH,
	CREDENTIAL_URL_MAX_LENGTH,
	CREDENTIAL_USERNAME_MAX_LENGTH,
	CredentialPayloadInputSchema as ContractCredentialPayloadInputSchema,
	CredentialPayloadSchema as ContractStoredCredentialPayloadSchema,
} from '@aegis/contracts';
import { describe, expect, it } from 'vitest';

import {
	CREDENTIAL_MAX_TAGS as DOMAIN_MAX_TAGS,
	CREDENTIAL_NAME_MAX_LENGTH as DOMAIN_NAME_MAX_LENGTH,
	CREDENTIAL_NOTES_MAX_LENGTH as DOMAIN_NOTES_MAX_LENGTH,
	CREDENTIAL_SECRET_MAX_LENGTH as DOMAIN_SECRET_MAX_LENGTH,
	CREDENTIAL_TAG_MAX_LENGTH as DOMAIN_TAG_MAX_LENGTH,
	CREDENTIAL_URL_MAX_LENGTH as DOMAIN_URL_MAX_LENGTH,
	CREDENTIAL_USERNAME_MAX_LENGTH as DOMAIN_USERNAME_MAX_LENGTH,
	CredentialPayloadSchema as DomainStoredCredentialPayloadSchema,
	parseCredentialPayload,
	validateCredentialPayload,
} from './credential-payload.js';

const oauth2Base = {
	type: 'oauth2',
	name: 'Example app',
	secret: 'TEST_CLIENT_SECRET',
	oauth2Metadata: {
		clientId: 'client-id',
		tokenUrl: 'https://example.com/token',
		grantType: 'client_credentials',
	},
};

const passwordBase = { type: 'password', name: 'Example', secret: 'secret' };

function domainAccepts(input: unknown): boolean {
	try {
		validateCredentialPayload(input);
		return true;
	} catch {
		return false;
	}
}

const inputCases: ReadonlyArray<readonly [string, unknown]> = [
	['valid OAuth2 metadata', oauth2Base],
	['missing required OAuth2 metadata', { ...oauth2Base, oauth2Metadata: undefined }],
	['unknown top-level field', { ...oauth2Base, extra: true }],
	[
		'unknown nested metadata field',
		{ ...oauth2Base, oauth2Metadata: { ...oauth2Base.oauth2Metadata, extra: true } },
	],
	['invalid grant type', { ...oauth2Base, oauth2Metadata: { grantType: 'password' } }],
	[
		'OAuth scopes exceed the maximum',
		{
			...oauth2Base,
			oauth2Metadata: {
				scopes: Array.from({ length: CREDENTIAL_MAX_TAGS + 1 }, (_, index) => `scope-${index}`),
			},
		},
	],
	['invalid OAuth metadata timestamp', { ...oauth2Base, oauth2Metadata: { expiresAt: '2026-11-03' } }],
	['blank credential name', { ...passwordBase, name: '   ' }],
	['maximum-length name', { ...passwordBase, name: 'n'.repeat(CREDENTIAL_NAME_MAX_LENGTH) }],
	['name over maximum length', { ...passwordBase, name: 'n'.repeat(CREDENTIAL_NAME_MAX_LENGTH + 1) }],
	['whitespace-only secret is allowed', { ...passwordBase, secret: '   ' }],
	[
		'secret over maximum length',
		{ ...passwordBase, secret: 's'.repeat(CREDENTIAL_SECRET_MAX_LENGTH + 1) },
	],
	[
		'username over maximum length',
		{ ...passwordBase, username: 'u'.repeat(CREDENTIAL_USERNAME_MAX_LENGTH + 1) },
	],
	[
		'URL over maximum length',
		{ ...passwordBase, url: `https://${'a'.repeat(CREDENTIAL_URL_MAX_LENGTH)}` },
	],
	[
		'notes over maximum length',
		{ ...passwordBase, notes: 'n'.repeat(CREDENTIAL_NOTES_MAX_LENGTH + 1) },
	],
	[
		'tag over maximum length',
		{ ...passwordBase, tags: ['t'.repeat(CREDENTIAL_TAG_MAX_LENGTH + 1)] },
	],
	[
		'more than the maximum number of distinct tags',
		{
			...passwordBase,
			tags: Array.from({ length: CREDENTIAL_MAX_TAGS + 1 }, (_, index) => `tag-${index}`),
		},
	],
	['invalid credential expiry timestamp', { ...passwordBase, expiresAt: '2026-11-03' }],
	[
		'duplicate tags over the limit are canonicalized before applying the bound',
		{ ...passwordBase, tags: Array.from({ length: CREDENTIAL_MAX_TAGS + 1 }, () => 'duplicate') },
	],
];

describe('credential validation parity with API contracts', () => {
	it('keeps mirrored field bounds aligned', () => {
		expect(DOMAIN_NAME_MAX_LENGTH).toBe(CREDENTIAL_NAME_MAX_LENGTH);
		expect(DOMAIN_SECRET_MAX_LENGTH).toBe(CREDENTIAL_SECRET_MAX_LENGTH);
		expect(DOMAIN_USERNAME_MAX_LENGTH).toBe(CREDENTIAL_USERNAME_MAX_LENGTH);
		expect(DOMAIN_URL_MAX_LENGTH).toBe(CREDENTIAL_URL_MAX_LENGTH);
		expect(DOMAIN_NOTES_MAX_LENGTH).toBe(CREDENTIAL_NOTES_MAX_LENGTH);
		expect(DOMAIN_TAG_MAX_LENGTH).toBe(CREDENTIAL_TAG_MAX_LENGTH);
		expect(DOMAIN_MAX_TAGS).toBe(CREDENTIAL_MAX_TAGS);
	});

	it.each(inputCases)('agrees for %s', (_label, input) => {
		expect(domainAccepts(input)).toBe(
			ContractCredentialPayloadInputSchema.safeParse(input).success,
		);
	});

	it.each([
		['valid stored payload', { ...passwordBase, schemaVersion: 1, tags: [] }],
		['missing schema version', { ...passwordBase, tags: [] }],
		['unknown stored field', { ...passwordBase, schemaVersion: 1, tags: [], extra: true }],
		[
			'stored payload with invalid OAuth timestamp',
			{
				...oauth2Base,
				schemaVersion: 1,
				tags: [],
				oauth2Metadata: { ...oauth2Base.oauth2Metadata, expiresAt: '2026-11-03' },
			},
		],
	])('keeps stored-payload acceptance aligned for %s', (_label, input) => {
		expect(DomainStoredCredentialPayloadSchema.safeParse(input).success).toBe(
			ContractStoredCredentialPayloadSchema.safeParse(input).success,
		);
	});

	it('canonicalizes duplicate tags the same way at both input boundaries', () => {
		const input = {
			...passwordBase,
			tags: Array.from({ length: CREDENTIAL_MAX_TAGS + 1 }, () => 'duplicate'),
		};
		expect(ContractCredentialPayloadInputSchema.parse(input).tags).toEqual(['duplicate']);
		expect(validateCredentialPayload(input).tags).toEqual(['duplicate']);
	});

	it('defaults missing tags consistently and validates canonical payloads after decryption', () => {
		const contractPayload = ContractCredentialPayloadInputSchema.parse(passwordBase);
		const domainPayload = validateCredentialPayload(passwordBase);
		expect(contractPayload.tags).toEqual([]);
		expect(domainPayload.tags).toEqual([]);

		const bytes = new TextEncoder().encode(JSON.stringify(domainPayload));
		expect(parseCredentialPayload(bytes)).toEqual(domainPayload);
	});
});
