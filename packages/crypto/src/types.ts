import { MalformedInputError } from './errors.js';

// Shared types for @aegis/crypto. Algorithm identifiers here are intentionally
// string literals so envelopes self-describe their scheme and version.

export const KDF_ALGORITHM = 'argon2id' as const;
export const WRAP_ALGORITHM = 'xchacha20-poly1305' as const;
export const ENVELOPE_VERSION = 1 as const;
export const AEAD_ALGORITHM: typeof WRAP_ALGORITHM = WRAP_ALGORITHM;

export type KdfAlgorithm = typeof KDF_ALGORITHM;
export type WrapAlgorithm = typeof WRAP_ALGORITHM;

export interface KdfParameters {
	algorithm: KdfAlgorithm;
	memoryKiB: number;
	passes: number;
	parallelism: number;
	tagLength: number;
	saltLength: number;
}

export interface VaultKeyEnvelopeKdf {
	algorithm: KdfAlgorithm;
	salt: string; // base64url
	memoryKiB: number;
	passes: number;
	parallelism: number;
	tagLength: number;
}

export interface VaultKeyEnvelopeWrap {
	algorithm: WrapAlgorithm;
	nonce: string; // base64url, 24 bytes
	ciphertext: string; // base64url, DEK (32 bytes) + 16-byte Poly1305 tag
}

export interface VaultKeyEnvelope {
	version: typeof ENVELOPE_VERSION;
	kdf: VaultKeyEnvelopeKdf;
	wrap: VaultKeyEnvelopeWrap;
}

export function toBase64Url(bytes: Uint8Array): string {
	// manual encode to avoid Buffer base64 padding quirks; returns url-safe no-pad
	let binary = '';
	for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] as number);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(value: string): Uint8Array {
	if (typeof value !== 'string' || value.length === 0) {
		throw new MalformedInputError('value must be a non-empty base64url string');
	}
	if (!/^[A-Za-z0-9_-]+$/.test(value)) {
		throw new MalformedInputError('value must use base64url characters only');
	}
	if (value.includes('=')) {
		throw new MalformedInputError('value must not include base64 padding');
	}
	const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
	let binary: string;
	try {
		binary = atob(padded);
	} catch {
		throw new MalformedInputError('value is not valid base64url');
	}
	const out = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) (out as Uint8Array)[i] = binary.charCodeAt(i);
	// Reject non-canonical encodings (trailing bits / invalid unpadded length).
	if (toBase64Url(out) !== value) {
		throw new MalformedInputError('value is not a canonical base64url encoding');
	}
	return out;
}
