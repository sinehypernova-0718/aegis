import { randomBytes } from 'node:crypto';

import { MalformedInputError } from '../errors.js';

/**
 * Emergency recovery key material.
 *
 * The key is a random 160-bit value encoded with the RFC 4648 base32 alphabet
 * (case-sensitive, unambiguous, no padding) and presented as `AEGIS-RCV` plus
 * eight dash-separated groups of four characters, e.g.
 * `AEGIS-RCV-7M2W-K4XQ-P2ZF-9QMD-3TVR-H8BC-6LWD`. It is never persisted by this
 * package: the caller returns it to the user exactly once, and the Envelope
 * wrapping under the recovery key (see `create-vault-session.ts`) is the only
 * record the backend keeps.
 */

export const RECOVERY_KEY_PREFIX = 'AEGIS-RCV';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const GROUP_LENGTH = 4;
const GROUP_COUNT = 8;
/** 20 bytes = 160 bits = exactly 32 base32 characters. */
const RANDOM_BYTE_COUNT = 20;

export type RecoveryKey = string & { readonly __brand: 'aegis-recovery-key' };

export function generateRecoveryKey(): RecoveryKey {
	const bytes = new Uint8Array(randomBytes(RANDOM_BYTE_COUNT));
	// Bit-accumulator base32 encode (no padding: 160 bits divides by 5 exactly).
	let chars = '';
	let value = 0;
	let bits = 0;
	for (const byte of bytes) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			chars += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	const groups: string[] = [];
	for (let index = 0; index < GROUP_COUNT; index++) {
		groups.push(chars.slice(index * GROUP_LENGTH, (index + 1) * GROUP_LENGTH));
	}
	return `${[RECOVERY_KEY_PREFIX, ...groups].join('-')}` as RecoveryKey;
}

/**
 * Validate externally supplied recovery-key input. Deliberately stricter than
 * the transport schema: the caller must hand over a well-formed generated key,
 * so malformed attempts fail before any Argon2id work is queued.
 */
export function validateRecoveryKey(candidate: string): RecoveryKey {
	if (typeof candidate !== 'string' || candidate.length === 0) {
		throw new MalformedInputError('recovery key must be a non-empty string');
	}
	// Whitespace/dash-insensitive normalisation: users retype groups with spaces
	// or without dashes, so compare against the fully de-dashed form.
	const plain = candidate.replace(/[\s-]+/g, '').toUpperCase();
	const deDashedPrefix = RECOVERY_KEY_PREFIX.replace('-', '');
	const body = plain.startsWith(deDashedPrefix) ? plain.slice(deDashedPrefix.length) : '';
	if (body.length !== GROUP_LENGTH * GROUP_COUNT || !/^[A-Z2-7]+$/.test(body)) {
		throw new MalformedInputError('recovery key is malformed');
	}
	// Canonical dash-grouped form, used verbatim for KDF derivation so the same
	// normalised string is reproduced identically at creation and recovery.
	return `${[RECOVERY_KEY_PREFIX, ...(body.match(/.{4}/g) as string[])].join('-')}` as RecoveryKey;
}