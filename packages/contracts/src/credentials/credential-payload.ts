import { z } from 'zod';

import { IsoUtcTimestampSchema } from '../common/timestamps.js';
import { boundedNonBlankString, strictObject } from '../common/conventions.js';
import { CREDENTIAL_KINDS, CredentialKindSchema, type CredentialKind } from './credential-kind.js';

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
}

const CredentialInputSchema = strictObject({
	type: CredentialKindSchema,
	name: boundedNonBlankString(1, CREDENTIAL_NAME_MAX_LENGTH),
	// Secrets may legitimately be whitespace-only, so only bound the length.
	secret: z.string().min(1).max(CREDENTIAL_SECRET_MAX_LENGTH),
	username: boundedNonBlankString(1, CREDENTIAL_USERNAME_MAX_LENGTH).optional(),
	url: boundedNonBlankString(1, CREDENTIAL_URL_MAX_LENGTH).optional(),
	notes: boundedNonBlankString(1, CREDENTIAL_NOTES_MAX_LENGTH).optional(),
	tags: z
		.array(boundedNonBlankString(1, CREDENTIAL_TAG_MAX_LENGTH))
		.max(CREDENTIAL_MAX_TAGS)
		.default([]),
	expiresAt: IsoUtcTimestampSchema.optional(),
});

const StoredCredentialPayloadSchema = CredentialInputSchema.extend({
	schemaVersion: z.literal(CREDENTIAL_PAYLOAD_SCHEMA_VERSION),
}).strict();

/** Parses and validates caller-provided credential fields. */
export const CredentialPayloadInputSchema: z.ZodType<
	CredentialPayloadFields,
	CredentialPayloadInput
> = CredentialInputSchema;

/** Parses and validates a stored/returned credential payload. */
export const CredentialPayloadSchema: z.ZodType<CredentialPayload, StoredCredentialPayloadInput> =
	StoredCredentialPayloadSchema;

/** Read-only list of supported kinds for documentation and parity tests. */
export const CONTRACT_CREDENTIAL_KINDS: readonly CredentialKind[] = CREDENTIAL_KINDS;
