import { z } from 'zod';
import { boundedNonBlankString, strictObject } from '../common/conventions.js';
import { IsoUtcTimestampSchema } from '../common/timestamps.js';
import { CREDENTIAL_KINDS, type CredentialKind, CredentialKindSchema } from './credential-kind.js';

/** Payload schema version stored inside the ciphertext. */
export const CREDENTIAL_PAYLOAD_SCHEMA_VERSION = 1 as const;

// Field bounds mirror `@aegis/domain`'s credential payload rules so the HTTP
// boundary rejects the same shapes the domain would refuse. The domain still
// re-validates (defense in depth) and remains authoritative for canonicalization.
export const CREDENTIAL_NAME_MAX_LENGTH = 256 as const;
export const CREDENTIAL_SECRET_MAX_LENGTH = 32_768 as const;
export const CREDENTIAL_USERNAME_MAX_LENGTH = 256 as const;
export const CREDENTIAL_URL_MAX_LENGTH = 2_048 as const;
export const CREDENTIAL_NOTES_MAX_LENGTH = 4_096 as const;
export const CREDENTIAL_TAG_MAX_LENGTH = 128 as const;
export const CREDENTIAL_MAX_TAGS = 32 as const;

const credentialTagsSchema = z
	.array(boundedNonBlankString(1, CREDENTIAL_TAG_MAX_LENGTH))
	.transform((tags) => [...new Set(tags)])
	.pipe(z.array(boundedNonBlankString(1, CREDENTIAL_TAG_MAX_LENGTH)).max(CREDENTIAL_MAX_TAGS))
	.default([]);

/** Validated caller-supplied credential fields (tags present). */
export interface CredentialPayloadFields {
	type: CredentialKind;
	name: string;
	secret: string;
	username?: string | undefined;
	url?: string | undefined;
	notes?: string | undefined;
	tags: string[];
	expiresAt?: string | undefined;
	oauth2Metadata?: OAuth2Metadata | undefined;
}

/** Stored OAuth2 details only; Aegis does not execute OAuth flows. */
export interface OAuth2Metadata {
	appName?: string | undefined;
	clientId?: string | undefined;
	clientSecret?: string | undefined;
	tokenUrl?: string | undefined;
	authUrl?: string | undefined;
	scopes?: string[] | undefined;
	grantType?:
		| 'authorization_code'
		| 'client_credentials'
		| 'refresh_token'
		| 'implicit'
		| undefined;
	expiresAt?: string | undefined;
	lastRefreshedAt?: string | undefined;
}

/** Caller-supplied credential fields accepted by the HTTP API. */
export interface CredentialPayloadInput {
	type: CredentialKind;
	name: string;
	secret: string;
	username?: string | undefined;
	url?: string | undefined;
	notes?: string | undefined;
	tags?: string[] | undefined;
	expiresAt?: string | undefined;
	oauth2Metadata?: OAuth2Metadata | undefined;
}

/** Stored payload input: caller fields plus the domain-stamped schema version. */
export interface StoredCredentialPayloadInput {
	schemaVersion: 1;
	type: CredentialKind;
	name: string;
	secret: string;
	username?: string | undefined;
	url?: string | undefined;
	notes?: string | undefined;
	tags?: string[] | undefined;
	expiresAt?: string | undefined;
	oauth2Metadata?: OAuth2Metadata | undefined;
}

/** Fully-populated credential payload returned by read endpoints. */
export interface CredentialPayload {
	schemaVersion: 1;
	type: CredentialKind;
	name: string;
	secret: string;
	username?: string | undefined;
	url?: string | undefined;
	notes?: string | undefined;
	tags: string[];
	expiresAt?: string | undefined;
	oauth2Metadata?: OAuth2Metadata | undefined;
}

const OAuth2MetadataSchema = strictObject({
	appName: boundedNonBlankString(1, CREDENTIAL_NAME_MAX_LENGTH).optional(),
	clientId: boundedNonBlankString(1, CREDENTIAL_NAME_MAX_LENGTH).optional(),
	clientSecret: z.string().min(1).max(CREDENTIAL_SECRET_MAX_LENGTH).optional(),
	tokenUrl: boundedNonBlankString(1, CREDENTIAL_URL_MAX_LENGTH).optional(),
	authUrl: boundedNonBlankString(1, CREDENTIAL_URL_MAX_LENGTH).optional(),
	scopes: z
		.array(boundedNonBlankString(1, CREDENTIAL_TAG_MAX_LENGTH))
		.max(CREDENTIAL_MAX_TAGS)
		.optional(),
	grantType: z
		.enum(['authorization_code', 'client_credentials', 'refresh_token', 'implicit'])
		.optional(),
	expiresAt: IsoUtcTimestampSchema.optional(),
	lastRefreshedAt: IsoUtcTimestampSchema.optional(),
});

const CredentialInputSchema = strictObject({
	type: CredentialKindSchema,
	name: boundedNonBlankString(1, CREDENTIAL_NAME_MAX_LENGTH),
	// Secrets may legitimately be whitespace-only, so only bound the length.
	secret: z.string().min(1).max(CREDENTIAL_SECRET_MAX_LENGTH),
	username: boundedNonBlankString(1, CREDENTIAL_USERNAME_MAX_LENGTH).optional(),
	url: boundedNonBlankString(1, CREDENTIAL_URL_MAX_LENGTH).optional(),
	notes: boundedNonBlankString(1, CREDENTIAL_NOTES_MAX_LENGTH).optional(),
	tags: credentialTagsSchema,
	expiresAt: IsoUtcTimestampSchema.optional(),
	oauth2Metadata: OAuth2MetadataSchema.optional(),
});

const StoredCredentialPayloadSchema = CredentialInputSchema.extend({
	schemaVersion: z.literal(CREDENTIAL_PAYLOAD_SCHEMA_VERSION),
})
	.strict()
	.superRefine((payload, context) => {
		if (payload.type === 'oauth2' && payload.oauth2Metadata === undefined) {
			context.addIssue({
				code: 'custom',
				path: ['oauth2Metadata'],
				message: 'required for oauth2 credentials',
			});
		}
	});

/** Parses and validates caller-provided credential fields. */
export const CredentialPayloadInputSchema: z.ZodType<
	CredentialPayloadFields,
	CredentialPayloadInput
> = CredentialInputSchema.superRefine((payload, context) => {
	if (payload.type === 'oauth2' && payload.oauth2Metadata === undefined) {
		context.addIssue({
			code: 'custom',
			path: ['oauth2Metadata'],
			message: 'required for oauth2 credentials',
		});
	}
});

/** Parses and validates a stored/returned credential payload. */
export const CredentialPayloadSchema: z.ZodType<CredentialPayload, StoredCredentialPayloadInput> =
	StoredCredentialPayloadSchema;

/** Read-only list of supported kinds for documentation and parity tests. */
export const CONTRACT_CREDENTIAL_KINDS: readonly CredentialKind[] = CREDENTIAL_KINDS;
