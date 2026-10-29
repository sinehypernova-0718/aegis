import { describe, expect, it } from 'vitest';

import { DefaultVaultSession } from './vault-session.js';
import { generateDek } from '../keys/generate-dek.js';
import { AuthenticationError, SessionDisposedError, UnsupportedVersionError } from '../errors.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function newSession(vaultId = 'vault-a') {
	return new DefaultVaultSession(vaultId, generateDek());
}

describe('VaultSession', () => {
	it('round-trips a record and never exposes the key', () => {
		const session = newSession();
		const enc = session.encryptRecord({ recordId: 'r1', plaintext: encoder.encode('value') });
		const out = session.decryptRecord({
			recordId: 'r1',
			encryptionVersion: enc.encryptionVersion,
			nonce: enc.nonce,
			ciphertext: enc.ciphertext,
		});
		expect(decoder.decode(out)).toBe('value');
		// Serialization must not leak key material.
		expect(JSON.stringify(session)).toBe('{}');
	});

	it('rejects an unsupported record encryption version', () => {
		const session = newSession();
		const enc = session.encryptRecord({ recordId: 'r1', plaintext: encoder.encode('value') });
		expect(() =>
			session.decryptRecord({
				recordId: 'r1',
				encryptionVersion: 2,
				nonce: enc.nonce,
				ciphertext: enc.ciphertext,
			}),
		).toThrow(UnsupportedVersionError);
	});

	it('fails authentication for a different vault (same key, AAD mismatch)', () => {
		const dek = generateDek();
		const a = new DefaultVaultSession('vault-a', dek);
		const b = new DefaultVaultSession('vault-b', dek);
		const enc = a.encryptRecord({ recordId: 'r1', plaintext: encoder.encode('value') });
		expect(() =>
			b.decryptRecord({
				recordId: 'r1',
				encryptionVersion: enc.encryptionVersion,
				nonce: enc.nonce,
				ciphertext: enc.ciphertext,
			}),
		).toThrow(AuthenticationError);
	});

	it('rejects use after disposal and is idempotent', () => {
		const session = newSession();
		expect(session.isDisposed).toBe(false);
		session.dispose();
		expect(session.isDisposed).toBe(true);
		expect(() => session.dispose()).not.toThrow();
		expect(() => session.encryptRecord({ recordId: 'r1', plaintext: encoder.encode('x') })).toThrow(
			SessionDisposedError,
		);
		expect(() =>
			session.decryptRecord({
				recordId: 'r1',
				encryptionVersion: 1,
				nonce: new Uint8Array(24),
				ciphertext: new Uint8Array(16),
			}),
		).toThrow(SessionDisposedError);
	});
});
