// Internal record-level authenticated encryption.
//
// IMPORTANT: This module operates on a raw 32-byte DEK. It is deliberately NOT
// exported from the package entry point (`src/index.ts`). Application and domain
// code must use the opaque `VaultSession` API instead, which keeps the DEK
// private. See `src/session/vault-session.ts`.
import { randomBytes } from 'node:crypto';
import { xchacha20poly1305 } from '@noble/ciphers/chacha';

import {
	AuthenticationError,
	InvalidParametersError,
	MalformedInputError,
	RecordSizeError,
} from '../errors.js';
import { DEK_LENGTH } from '../keys/generate-dek.js';

/** Encryption format version stored in `vault_records.encryption_version`. */
export const RECORD_ENCRYPTION_VERSION = 1 as const;
export const RECORD_AEAD_ALGORITHM = 'xchacha20-poly1305' as const;
export const RECORD_NONCE_LENGTH = 24 as const;
export const RECORD_TAG_LENGTH = 16 as const;
export const RECORD_AAD_LABEL = 'aegis:credential:v1' as const;

/** Maximum serialized plaintext payload size, measured in bytes. */
export const MAX_RECORD_PLAINTEXT_BYTES = 65_536 as const;
/** Maximum ciphertext size = plaintext + Poly1305 tag. */
export const MAX_RECORD_CIPHERTEXT_BYTES: number =
	MAX_RECORD_PLAINTEXT_BYTES + RECORD_TAG_LENGTH;

export interface RecordAadContext {
	readonly vaultId: string;
	readonly recordId: string;
	readonly encryptionVersion: number;
}

export interface EncryptedRecord {
	readonly encryptionVersion: number;
	readonly nonce: Uint8Array;
	readonly ciphertext: Uint8Array;
}

const encoder = new TextEncoder();

function lengthPrefixed(bytes: Uint8Array): Uint8Array {
	const out = new Uint8Array(4 + bytes.length);
	new DataView(out.buffer, out.byteOffset, out.byteLength).setUint32(0, bytes.length, false);
	out.set(bytes, 4);
	return out;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
	let total = 0;
	for (const part of parts) total += part.length;
	const out = new Uint8Array(total);
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}

/**
 * Deterministic, unambiguous, domain-separated AAD encoder.
 *
 * Each variable-length field is length-prefixed with a 32-bit big-endian length,
 * so distinct field tuples can never collide via delimiter ambiguity.
 *
 * Layout: `[u32 len][label][u32 len][version][u32 len][vaultId][u32 len][recordId]`.
 */
export function encodeRecordAad(context: RecordAadContext): Uint8Array {
	if (typeof context !== 'object' || context === null) {
		throw new InvalidParametersError('AAD context must be an object');
	}
	const { vaultId, recordId, encryptionVersion } = context;
	if (typeof vaultId !== 'string' || vaultId.length === 0) {
		throw new InvalidParametersError('AAD vaultId must be a non-empty string');
	}
	if (typeof recordId !== 'string' || recordId.length === 0) {
		throw new InvalidParametersError('AAD recordId must be a non-empty string');
	}
	if (!Number.isInteger(encryptionVersion) || encryptionVersion < 0 || encryptionVersion > 255) {
		throw new InvalidParametersError('AAD encryptionVersion must be an integer in [0, 255]');
	}
	return concat([
		lengthPrefixed(encoder.encode(RECORD_AAD_LABEL)),
		lengthPrefixed(encoder.encode(String(encryptionVersion))),
		lengthPrefixed(encoder.encode(vaultId)),
		lengthPrefixed(encoder.encode(recordId)),
	]);
}

function assertDek(dek: Uint8Array): void {
	if (!(dek instanceof Uint8Array) || dek.length !== DEK_LENGTH) {
		throw new InvalidParametersError(`DEK must be ${DEK_LENGTH} bytes`);
	}
}

export function encryptRecord(
	dek: Uint8Array,
	context: RecordAadContext,
	plaintext: Uint8Array,
): EncryptedRecord {
	assertDek(dek);
	if (!(plaintext instanceof Uint8Array)) {
		throw new InvalidParametersError('plaintext must be a Uint8Array');
	}
	if (plaintext.length > MAX_RECORD_PLAINTEXT_BYTES) {
		throw new RecordSizeError(
			`plaintext exceeds the ${MAX_RECORD_PLAINTEXT_BYTES}-byte record limit`,
		);
	}
	const aad = encodeRecordAad(context);
	const nonce = new Uint8Array(randomBytes(RECORD_NONCE_LENGTH));
	const cipher = xchacha20poly1305(dek, nonce, aad);
	const ciphertext = cipher.encrypt(plaintext);
	return { encryptionVersion: context.encryptionVersion, nonce, ciphertext };
}

export interface DecryptRecordInput {
	readonly context: RecordAadContext;
	readonly nonce: Uint8Array;
	readonly ciphertext: Uint8Array;
}

export function decryptRecord(dek: Uint8Array, input: DecryptRecordInput): Uint8Array {
	assertDek(dek);
	const { context, nonce, ciphertext } = input;
	if (!(nonce instanceof Uint8Array) || nonce.length !== RECORD_NONCE_LENGTH) {
		throw new MalformedInputError(`record nonce must be ${RECORD_NONCE_LENGTH} bytes`);
	}
	if (!(ciphertext instanceof Uint8Array) || ciphertext.length < RECORD_TAG_LENGTH) {
		throw new MalformedInputError('record ciphertext is too short to contain an auth tag');
	}
	if (ciphertext.length > MAX_RECORD_CIPHERTEXT_BYTES) {
		throw new RecordSizeError(
			`ciphertext exceeds the ${MAX_RECORD_CIPHERTEXT_BYTES}-byte record limit`,
		);
	}
	const aad = encodeRecordAad(context);
	const cipher = xchacha20poly1305(dek, nonce, aad);
	try {
		return cipher.decrypt(ciphertext);
	} catch {
		throw new AuthenticationError(
			'record decryption failed (wrong key, tampering, or AAD context mismatch)',
		);
	}
}
