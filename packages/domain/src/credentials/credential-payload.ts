import {
	ENCRYPTED_PAYLOAD_MAX_BYTES,
	IsoUtcTimestampSchema,
	boundedNonBlankString,
} from '@aegis/contracts';
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
}

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
	})
	.strict();

/** Schema for the persisted/decrypted representation, including `schemaVersion`. */
const StoredCredentialPayloadSchema = CredentialInputSchema.extend({
	schemaVersion: z.literal(CREDENTIAL_PAYLOAD_SCHEMA_VERSION),
}).strict();

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
	const result = CredentialInputSchema.safeParse(dedupeTags(input));
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
