import { CURSOR_MAX_LENGTH, EntityIdSchema, IsoUtcTimestampSchema } from '@aegis/contracts';
import { z } from 'zod';

import { InvalidCursorError } from '../errors/domain-errors.js';

export const CURSOR_DECODED_MAX_BYTES = 256 as const;

export interface CredentialCursor {
	readonly createdAt: string;
	readonly id: string;
}

const CursorPayloadSchema = z
	.object({
		v: z.literal(1),
		createdAt: IsoUtcTimestampSchema,
		id: EntityIdSchema,
	})
	.strict();

const BASE64URL = /^[A-Za-z0-9_-]+$/;

export function encodeCredentialCursor(cursor: CredentialCursor): string {
	const json = JSON.stringify({ v: 1, createdAt: cursor.createdAt, id: cursor.id });
	return Buffer.from(json, 'utf8').toString('base64url');
}

/**
 * Strictly decode a keyset cursor. Bounds length and decoded size, validates the
 * base64url alphabet, requires a strict JSON object with an exact version, and
 * validates the timestamp and id shapes. Any deviation is rejected.
 */
export function decodeCredentialCursor(cursor: string): CredentialCursor {
	if (typeof cursor !== 'string' || cursor.length === 0) {
		throw new InvalidCursorError('cursor must be a non-empty string');
	}
	if (cursor.length > CURSOR_MAX_LENGTH) {
		throw new InvalidCursorError('cursor exceeds the maximum length');
	}
	if (!BASE64URL.test(cursor)) {
		throw new InvalidCursorError('cursor is not valid base64url');
	}
	const bytes = Buffer.from(cursor, 'base64url');
	if (bytes.length === 0 || bytes.length > CURSOR_DECODED_MAX_BYTES) {
		throw new InvalidCursorError('cursor payload size is invalid');
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(bytes.toString('utf8'));
	} catch {
		throw new InvalidCursorError('cursor is not valid JSON');
	}
	const result = CursorPayloadSchema.safeParse(parsed);
	if (!result.success) {
		throw new InvalidCursorError('cursor payload is invalid');
	}
	return { createdAt: result.data.createdAt, id: result.data.id };
}
