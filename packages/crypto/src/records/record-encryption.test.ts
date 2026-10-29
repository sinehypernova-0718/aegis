import { describe, expect, it } from 'vitest';

import {
	MAX_RECORD_PLAINTEXT_BYTES,
	RECORD_ENCRYPTION_VERSION,
	decryptRecord,
	encryptRecord,
	encodeRecordAad,
} from './record-encryption.js';
import { generateDek } from '../keys/generate-dek.js';
import { AuthenticationError, RecordSizeError } from '../errors.js';

const encoder = new TextEncoder();

function context(vaultId = 'vault-a', recordId = 'record-1') {
	return { vaultId, recordId, encryptionVersion: RECORD_ENCRYPTION_VERSION };
}

describe('record encryption', () => {
	it('round-trips a payload', () => {
		const dek = generateDek();
		const plaintext = encoder.encode('hello aegis');
		const enc = encryptRecord(dek, context(), plaintext);
		expect(enc.encryptionVersion).toBe(RECORD_ENCRYPTION_VERSION);
		expect(enc.nonce.length).toBe(24);
		const out = decryptRecord(dek, {
			context: context(),
			nonce: enc.nonce,
			ciphertext: enc.ciphertext,
		});
		expect(new TextDecoder().decode(out)).toBe('hello aegis');
	});

	it('uses a fresh nonce for identical plaintext', () => {
		const dek = generateDek();
		const plaintext = encoder.encode('same');
		const a = encryptRecord(dek, context(), plaintext);
		const b = encryptRecord(dek, context(), plaintext);
		expect(Buffer.from(a.nonce).toString('hex')).not.toBe(Buffer.from(b.nonce).toString('hex'));
	});

	it('rejects tampered ciphertext', () => {
		const dek = generateDek();
		const enc = encryptRecord(dek, context(), encoder.encode('secret'));
		const tampered = enc.ciphertext.slice();
		tampered[0] = (tampered[0] as number) ^ 0x01;
		expect(() =>
			decryptRecord(dek, { context: context(), nonce: enc.nonce, ciphertext: tampered }),
		).toThrow(AuthenticationError);
	});

	it('binds ciphertext to the vault and record id (AAD)', () => {
		const dek = generateDek();
		const enc = encryptRecord(dek, context('vault-a', 'record-1'), encoder.encode('secret'));
		expect(() =>
			decryptRecord(dek, {
				context: context('vault-b', 'record-1'),
				nonce: enc.nonce,
				ciphertext: enc.ciphertext,
			}),
		).toThrow(AuthenticationError);
		expect(() =>
			decryptRecord(dek, {
				context: context('vault-a', 'record-2'),
				nonce: enc.nonce,
				ciphertext: enc.ciphertext,
			}),
		).toThrow(AuthenticationError);
	});

	it('rejects oversized plaintext', () => {
		const dek = generateDek();
		const tooBig = new Uint8Array(MAX_RECORD_PLAINTEXT_BYTES + 1);
		expect(() => encryptRecord(dek, context(), tooBig)).toThrow(RecordSizeError);
	});

	it('encodes AAD deterministically and unambiguously', () => {
		const a = encodeRecordAad(context('a', 'bc'));
		const b = encodeRecordAad(context('a', 'bc'));
		expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
		// ('ab','c') must not collide with ('a','bc').
		const ambiguous = encodeRecordAad(context('ab', 'c'));
		expect(Buffer.from(a).equals(Buffer.from(ambiguous))).toBe(false);
	});
});
