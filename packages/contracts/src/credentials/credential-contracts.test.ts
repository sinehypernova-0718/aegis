import { describe, expect, it } from 'vitest';

import {
	CREDENTIAL_MAX_TAGS,
	CREDENTIAL_NAME_MAX_LENGTH,
	CREDENTIAL_SECRET_MAX_LENGTH,
	CREDENTIAL_TAG_MAX_LENGTH,
	CONTRACT_CREDENTIAL_KINDS,
	CreateCredentialRequestSchema,
	CreateCredentialResponseSchema,
	CredentialDetailSchema,
	CredentialParamsSchema,
	CredentialPayloadInputSchema,
	CredentialPayloadSchema,
	CredentialSummarySchema,
	DeleteCredentialResponseSchema,
	PAGINATION_MAX_LIMIT,
	ListCredentialsQuerySchema,
	ListCredentialsResponseSchema,
	UpdateCredentialRequestSchema,
	UpdateCredentialResponseSchema,
} from '../index.js';

const VAULT_ID = '00000000-0000-4000-8000-000000000001';
const CREDENTIAL_ID = '00000000-0000-4000-8000-000000000002';
const CREATED_AT = '2026-01-01T00:00:00.000Z';
const UPDATED_AT = '2026-01-02T00:00:00.000Z';

const storedPayload = {
	schemaVersion: 1 as const,
	type: 'password' as const,
	name: 'GitHub',
	secret: 'TEST_SECRET_MARKER_7c91',
	tags: ['work'],
};

describe('credential contracts', () => {
	it('mirrors the documented credential kinds', () => {
		expect(CONTRACT_CREDENTIAL_KINDS).toEqual([
			'password',
			'api_key',
			'access_token',
			'refresh_token',
			'ssh_key',
			'certificate',
			'recovery_code',
			'secure_note',
		]);
	});

	it('accepts a valid create request and applies the tags default', () => {
		const parsed = CreateCredentialRequestSchema.parse({
			payload: { type: 'api_key', name: 'Stripe', secret: 'sk_test' },
		});
		expect(parsed.payload.tags).toEqual([]);
	});

	it('rejects unknown keys at both levels', () => {
		expect(() =>
			CreateCredentialRequestSchema.parse({
				payload: { type: 'api_key', name: 'Stripe', secret: 'sk_test' },
				extra: true,
			}),
		).toThrow();
		expect(() =>
			CreateCredentialRequestSchema.parse({
				payload: { type: 'api_key', name: 'Stripe', secret: 'sk_test', schemaVersion: 1 },
			}),
		).toThrow();
	});

	it('enforces field bounds', () => {
		expect(() =>
			CredentialPayloadInputSchema.parse({
				type: 'password',
				name: 'x'.repeat(CREDENTIAL_NAME_MAX_LENGTH + 1),
				secret: 's',
			}),
		).toThrow();
		expect(() =>
			CredentialPayloadInputSchema.parse({
				type: 'password',
				name: 'n',
				secret: 'x'.repeat(CREDENTIAL_SECRET_MAX_LENGTH + 1),
			}),
		).toThrow();
		expect(() =>
			CredentialPayloadInputSchema.parse({
				type: 'password',
				name: 'n',
				secret: 's',
				tags: Array.from({ length: CREDENTIAL_MAX_TAGS + 1 }, (_, i) => `t${i}`),
			}),
		).toThrow();
		expect(() =>
			CredentialPayloadInputSchema.parse({
				type: 'password',
				name: 'n',
				secret: 's',
				tags: ['x'.repeat(CREDENTIAL_TAG_MAX_LENGTH + 1)],
			}),
		).toThrow();
	});

	it('does not echo secret values in validation errors', () => {
		const marker = 'LEAKED_SECRET_MARKER_1234';
		const result = CredentialPayloadInputSchema.safeParse({
			type: 'password',
			name: 'n',
			secret: 's',
			unknownField: marker,
		});
		expect(result.success).toBe(false);
		expect(JSON.stringify(result.error?.issues)).not.toContain(marker);
	});

	it('requires a schema version on stored payloads', () => {
		expect(CredentialPayloadSchema.parse(storedPayload)).toEqual(storedPayload);
		expect(() =>
			CredentialPayloadSchema.parse({
				type: 'password',
				name: 'n',
				secret: 's',
				tags: [],
			}),
		).toThrow();
	});

	it('keeps secrets out of credential summaries', () => {
		const summary = {
			id: CREDENTIAL_ID,
			createdAt: CREATED_AT,
			updatedAt: UPDATED_AT,
			type: 'password' as const,
			name: 'GitHub',
			tags: ['work'],
		};
		expect(CredentialSummarySchema.parse(summary)).toEqual(summary);
		expect(() =>
			CredentialSummarySchema.parse({ ...summary, secret: 'TEST_SECRET_MARKER_7c91' }),
		).toThrow();
		expect(() =>
			CredentialSummarySchema.parse({ ...summary, notes: 'TEST_PRIVATE_NOTE_MARKER_4d28' }),
		).toThrow();
		expect(CreateCredentialResponseSchema.parse(summary)).toEqual(summary);
	});

	it('accepts a valid update request', () => {
		const parsed = UpdateCredentialRequestSchema.parse({
			payload: { type: 'password', name: 'GitHub', secret: 'updated' },
		});
		expect(parsed.payload.secret).toBe('updated');
		expect(() =>
			UpdateCredentialRequestSchema.parse({
				payload: { type: 'password', name: 'GitHub', secret: 'updated' },
				extra: true,
			}),
		).toThrow();
	});

	it('validates detail, update, delete, and params contracts', () => {
		const detail = {
			id: CREDENTIAL_ID,
			createdAt: CREATED_AT,
			updatedAt: UPDATED_AT,
			payload: storedPayload,
		};
		expect(CredentialDetailSchema.parse(detail)).toEqual(detail);
		expect(
			UpdateCredentialResponseSchema.parse({ id: CREDENTIAL_ID, updatedAt: UPDATED_AT }),
		).toEqual({ id: CREDENTIAL_ID, updatedAt: UPDATED_AT });
		expect(DeleteCredentialResponseSchema.parse({ id: CREDENTIAL_ID, deleted: true })).toEqual({
			id: CREDENTIAL_ID,
			deleted: true,
		});
		expect(
			CredentialParamsSchema.parse({ vaultId: VAULT_ID, credentialId: CREDENTIAL_ID }),
		).toEqual({ vaultId: VAULT_ID, credentialId: CREDENTIAL_ID });
		expect(() =>
			CredentialParamsSchema.parse({ vaultId: VAULT_ID, credentialId: CREDENTIAL_ID, x: 'y' }),
		).toThrow();
	});

	it('coerces and bounds the list query', () => {
		expect(ListCredentialsQuerySchema.parse({})).toEqual({ limit: 20 });
		expect(ListCredentialsQuerySchema.parse({ limit: '10' })).toEqual({ limit: 10 });
		expect(ListCredentialsQuerySchema.parse({ limit: 1, cursor: null })).toEqual({
			limit: 1,
			cursor: null,
		});
		expect(() => ListCredentialsQuerySchema.parse({ limit: '0' })).toThrow();
		expect(() =>
			ListCredentialsQuerySchema.parse({ limit: `${PAGINATION_MAX_LIMIT + 1}` }),
		).toThrow();
		expect(() => ListCredentialsQuerySchema.parse({ limit: 'ten' })).toThrow();
		expect(() => ListCredentialsQuerySchema.parse({ unknown: 'x' })).toThrow();
	});

	it('validates the list response envelope', () => {
		const summary = {
			id: CREDENTIAL_ID,
			createdAt: CREATED_AT,
			updatedAt: UPDATED_AT,
			type: 'password' as const,
			name: 'GitHub',
			tags: [],
		};
		expect(ListCredentialsResponseSchema.parse({ items: [summary], nextCursor: null })).toEqual({
			items: [summary],
			nextCursor: null,
		});
		expect(() =>
			ListCredentialsResponseSchema.parse({
				items: [{ ...summary, secret: 'leak' }],
				nextCursor: null,
			}),
		).toThrow();
	});

	it('rejects secret fields smuggled into update responses', () => {
		expect(() =>
			UpdateCredentialResponseSchema.parse({
				id: CREDENTIAL_ID,
				updatedAt: UPDATED_AT,
				secret: 'leak',
			}),
		).toThrow();
	});
});
