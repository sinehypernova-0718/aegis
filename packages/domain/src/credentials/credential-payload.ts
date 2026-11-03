import { z } from 'zod';

import { InvalidCredentialPayloadError } from '../errors/domain-errors.js';
import { CREDENTIAL_KINDS, type CredentialKind } from './credential-kind.js';

/** Payload schema version stored inside the ciphertext (distinct from the
 * record *encryption* version). */
export const CREDENTIAL_PAYLOAD_SCHEMA_VERSION = 1 as const;

// Field bounds. `secret` is larger than the generic long-text bound so PEM/SSH
// material fits; the total serialized payload is still capped by
// ENCRYPTED_PAYLOAD_MAX_BYTES.
export const CREDENTIAL_NAME_MAX_LENGTH = 256 as const;
export const CREDENTIAL_SECRET_MAX_LENGTH = 32_768 as const;
export const CREDENTIAL_USERNAME_MAX_LENGTH = 256 as const;
export const CREDENTIAL_URL_MAX_LENGTH = 2_048 as const;
export const CREDENTIAL_NOTES_MAX_LENGTH = 4_096 as const;
export const CREDENTIAL_TAG_MAX_LENGTH = 128 as const;
export const CREDENTIAL_MAX_TAGS = 32 as const;
const ENCRYPTED_PAYLOAD_MAX_BYTES = 65_536;
const IsoUtcTimestampSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
	.refine((value) => {
		const date = new Date(value);
		return !Number.isNaN(date.getTime()) && date.toISOString() === value;
	});
const boundedNonBlankString = (minimum: number, maximum: number) =>
	z
		.string()
		.min(minimum)
		.max(maximum)
		.refine((value) => value.trim().length >= minimum);

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

/** User-supplied credential fields. `schemaVersion` is stamped by the domain. */
export interface CredentialPayloadInput {
	type: CredentialKind;
	name: string;
	secret: string;
	username?: string;
	url?: string;
	notes?: string;
	tags?: string[];
	expiresAt?: string;
	oauth2Metadata?: OAuth2Metadata;
}

/** Validated, canonical credential payload as stored inside the ciphertext. */
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

/**
 * Accepted-on-input shape of the stored payload. `tags` is optional on the way
 * in because the schema defaults it to `[]`.
 */
interface StoredCredentialPayloadInput {
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

const OAuth2MetadataSchema = z
	.object({
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
	})
	.strict();

/**
 * Schema for caller-provided credential input. It validates only fields the
 * caller may provide and deliberately excludes `schemaVersion`, which the
 * domain stamps when constructing the stored payload.
 */
const CredentialInputSchema = z
	.object({
		type: z.enum(CREDENTIAL_KINDS),
		name: boundedNonBlankString(1, CREDENTIAL_NAME_MAX_LENGTH),
		secret: z.string().min(1).max(CREDENTIAL_SECRET_MAX_LENGTH),
		username: boundedNonBlankString(1, CREDENTIAL_USERNAME_MAX_LENGTH).optional(),
		url: boundedNonBlankString(1, CREDENTIAL_URL_MAX_LENGTH).optional(),
		notes: boundedNonBlankString(1, CREDENTIAL_NOTES_MAX_LENGTH).optional(),
		tags: z
			.array(boundedNonBlankString(1, CREDENTIAL_TAG_MAX_LENGTH))
			.max(CREDENTIAL_MAX_TAGS)
			.default([]),
		expiresAt: IsoUtcTimestampSchema.optional(),
		oauth2Metadata: OAuth2MetadataSchema.optional(),
	})
	.strict();

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

/** Schema for the persisted/decrypted representation, including `schemaVersion`. */
/**
 * Public schema for the stored credential payload. Its declared input type
 * honestly reflects that `schemaVersion` is required and that `tags` is optional
 * on the way in; its output is the fully-populated `CredentialPayload`.
 */
export const CredentialPayloadSchema: z.ZodType<CredentialPayload, StoredCredentialPayloadInput> =
	StoredCredentialPayloadSchema;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface ParsedFields {
	type: CredentialKind;
	name: string;
	secret: string;
	tags: string[];
	username?: string | undefined;
	url?: string | undefined;
	notes?: string | undefined;
	expiresAt?: string | undefined;
	oauth2Metadata?: OAuth2Metadata | undefined;
}

function toPayload(fields: ParsedFields): CredentialPayload {
	return {
		schemaVersion: CREDENTIAL_PAYLOAD_SCHEMA_VERSION,
		type: fields.type,
		name: fields.name,
		secret: fields.secret,
		tags: fields.tags,
		...(fields.username !== undefined ? { username: fields.username } : {}),
		...(fields.url !== undefined ? { url: fields.url } : {}),
		...(fields.notes !== undefined ? { notes: fields.notes } : {}),
		...(fields.expiresAt !== undefined ? { expiresAt: fields.expiresAt } : {}),
		...(fields.oauth2Metadata !== undefined ? { oauth2Metadata: fields.oauth2Metadata } : {}),
	};
}

function dedupeTags(input: unknown): unknown {
	if (typeof input !== 'object' || input === null) return input;
	const record = input as Record<string, unknown>;
	if (!Array.isArray(record.tags)) return input;
	const seen = new Set<string>();
	const deduped: unknown[] = [];
	for (const tag of record.tags) {
		if (typeof tag === 'string') {
			if (seen.has(tag)) continue;
			seen.add(tag);
		}
		deduped.push(tag);
	}
	return { ...record, tags: deduped };
}

/**
 * Validate and canonicalize user-supplied credential fields using the caller
 * input schema. `schemaVersion` is always stamped to the current version. Exact
 * duplicate tags are removed (case-sensitive, first occurrence wins) before the
 * tag-count bound is applied.
 */
export function validateCredentialPayload(input: unknown): CredentialPayload {
	const result = CredentialInputSchema.superRefine((payload, context) => {
		if (payload.type === 'oauth2' && payload.oauth2Metadata === undefined) {
			context.addIssue({
				code: 'custom',
				path: ['oauth2Metadata'],
				message: 'required for oauth2 credentials',
			});
		}
	}).safeParse(dedupeTags(input));
	if (!result.success) {
		throw new InvalidCredentialPayloadError('invalid credential payload');
	}
	return toPayload(result.data);
}

/**
 * Canonically serialize a payload for encryption: fixed key order, optional
 * keys omitted when absent, UTF-8 bytes bounded by ENCRYPTED_PAYLOAD_MAX_BYTES.
 */
export function serializeCredentialPayload(payload: CredentialPayload): Uint8Array {
	const canonical: Record<string, unknown> = {
		schemaVersion: payload.schemaVersion,
		type: payload.type,
		name: payload.name,
		secret: payload.secret,
	};
	if (payload.username !== undefined) canonical.username = payload.username;
	if (payload.url !== undefined) canonical.url = payload.url;
	if (payload.notes !== undefined) canonical.notes = payload.notes;
	canonical.tags = [...payload.tags];
	if (payload.expiresAt !== undefined) canonical.expiresAt = payload.expiresAt;
	if (payload.oauth2Metadata !== undefined) canonical.oauth2Metadata = payload.oauth2Metadata;

	const bytes = encoder.encode(JSON.stringify(canonical));
	if (bytes.length > ENCRYPTED_PAYLOAD_MAX_BYTES) {
		throw new InvalidCredentialPayloadError(
			`serialized payload exceeds ${ENCRYPTED_PAYLOAD_MAX_BYTES} bytes`,
		);
	}
	return bytes;
}

/** Parse and validate a decrypted payload using the stored-payload schema. */
export function parseCredentialPayload(bytes: Uint8Array): CredentialPayload {
	let parsed: unknown;
	try {
		parsed = JSON.parse(decoder.decode(bytes));
	} catch {
		throw new InvalidCredentialPayloadError('decrypted payload is not valid JSON');
	}
	const result = StoredCredentialPayloadSchema.safeParse(parsed);
	if (!result.success) {
		throw new InvalidCredentialPayloadError('decrypted payload failed schema validation');
	}
	return toPayload(result.data);
}
