import { CredentialPayloadInputSchema as ContractCredentialPayloadInputSchema } from '@aegis/contracts';
import { describe, expect, it } from 'vitest';

import { validateCredentialPayload } from './credential-payload.js';

const base = {
	type: 'oauth2',
	name: 'Example app',
	secret: 'TEST_CLIENT_SECRET',
	oauth2Metadata: {
		clientId: 'client-id',
		tokenUrl: 'https://example.com/token',
		grantType: 'client_credentials',
	},
};

function domainAccepts(input: unknown): boolean {
	try {
		validateCredentialPayload(input);
		return true;
	} catch {
		return false;
	}
}

describe('credential validation parity with API contracts', () => {
	it.each([
		['valid OAuth2 metadata', base],
		['missing required OAuth2 metadata', { ...base, oauth2Metadata: undefined }],
		['unknown top-level field', { ...base, extra: true }],
		[
			'unknown nested metadata field',
			{ ...base, oauth2Metadata: { ...base.oauth2Metadata, extra: true } },
		],
		['invalid grant type', { ...base, oauth2Metadata: { grantType: 'password' } }],
		[
			'scopes exceed the shared bound',
			{
				...base,
				oauth2Metadata: { scopes: Array.from({ length: 33 }, (_, index) => `scope-${index}`) },
			},
		],
		['invalid metadata timestamp', { ...base, oauth2Metadata: { expiresAt: '2026-01-01' } }],
		['blank credential name', { ...base, name: '   ' }],
	])('agrees for %s', (_label, input) => {
		expect(domainAccepts(input)).toBe(
			ContractCredentialPayloadInputSchema.safeParse(input).success,
		);
	});
});
