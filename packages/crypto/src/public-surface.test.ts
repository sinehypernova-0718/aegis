import { describe, expect, it } from 'vitest';

import * as crypto from './index.js';

describe('@aegis/crypto public surface (narrowed)', () => {
	it('exposes the high-level session API', () => {
		expect(typeof crypto.createVaultSession).toBe('function');
		expect(typeof crypto.unlockVaultSession).toBe('function');
		expect(typeof crypto.validateVaultKeyEnvelope).toBe('function');
		expect(typeof crypto.createVaultKeyMaterial).toBe('function');
	});

	it('does not expose raw-key primitives', () => {
		for (const name of [
			'deriveKek',
			'generateSalt',
			'generateDek',
			'DEK_LENGTH',
			'wrapKey',
			'unwrapKey',
			'WRAP_AAD',
			'createVaultKeyEnvelope',
			'validateKdfParameters',
			'KDF_DEFAULTS',
			'KDF_MINIMUMS',
			'KDF_MAXIMUMS',
			'encryptRecord',
			'decryptRecord',
			'encodeRecordAad',
		]) {
			expect(crypto, `unexpected public export: ${name}`).not.toHaveProperty(name);
		}
	});

	it('exposes record format constants', () => {
		expect(crypto.RECORD_ENCRYPTION_VERSION).toBe(1);
		expect(crypto.MAX_RECORD_PLAINTEXT_BYTES).toBe(65_536);
		expect(crypto.MAX_RECORD_CIPHERTEXT_BYTES).toBe(65_552);
	});
});
