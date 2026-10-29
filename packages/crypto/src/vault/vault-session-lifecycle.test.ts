import { describe, expect, it } from 'vitest';

import { createVaultSession } from './create-vault-session.js';
import { unlockVaultSession } from './unlock-vault-session.js';
import { validateVaultKeyEnvelope } from '../envelope/validate-envelope.js';
import {
	AuthenticationError,
	EnvelopeValidationError,
	MalformedInputError,
	UnsupportedVersionError,
} from '../errors.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const VAULT_ID = '11111111-1111-4111-8111-111111111111';
const RECORD_ID = '22222222-2222-4222-8222-222222222222';

describe('vault session lifecycle (create + unlock)', () => {
	it('creates an envelope and a usable session', async () => {
		const { envelope, session } = await createVaultSession({
			vaultId: VAULT_ID,
			passphrase: 'correct horse battery staple',
		});
		expect(validateVaultKeyEnvelope(envelope)).toEqual(envelope);
		expect(session.vaultId).toBe(VAULT_ID);
		const enc = session.encryptRecord({ recordId: RECORD_ID, plaintext: encoder.encode('secret') });
		expect(enc.encryptionVersion).toBe(1);
		session.dispose();
	});

	it('unlocks with the correct passphrase and decrypts the same record', async () => {
		const passphrase = 'passphrase-123';
		const { envelope, session } = await createVaultSession({ vaultId: VAULT_ID, passphrase });
		const enc = session.encryptRecord({ recordId: RECORD_ID, plaintext: encoder.encode('secret') });

		const unlocked = await unlockVaultSession({ vaultId: VAULT_ID, passphrase, envelope });
		const out = unlocked.decryptRecord({
			recordId: RECORD_ID,
			encryptionVersion: enc.encryptionVersion,
			nonce: enc.nonce,
			ciphertext: enc.ciphertext,
		});
		expect(decoder.decode(out)).toBe('secret');
	});

	it('rejects a wrong passphrase without producing a session', async () => {
		const { envelope } = await createVaultSession({ vaultId: VAULT_ID, passphrase: 'right' });
		await expect(
			unlockVaultSession({ vaultId: VAULT_ID, passphrase: 'wrong', envelope }),
		).rejects.toBeInstanceOf(AuthenticationError);
	});

	it('rejects a malformed envelope before any KDF work', async () => {
		await expect(
			unlockVaultSession({ vaultId: VAULT_ID, passphrase: 'pw', envelope: { nope: true } }),
		).rejects.toBeInstanceOf(EnvelopeValidationError);
	});

	it('rejects an unsupported envelope version', async () => {
		const { envelope } = await createVaultSession({ vaultId: VAULT_ID, passphrase: 'pw' });
		await expect(
			unlockVaultSession({
				vaultId: VAULT_ID,
				passphrase: 'pw',
				envelope: { ...envelope, version: 2 },
			}),
		).rejects.toBeInstanceOf(UnsupportedVersionError);
	});

	it('rejects an empty vault id or passphrase', async () => {
		await expect(createVaultSession({ vaultId: '', passphrase: 'pw' })).rejects.toBeInstanceOf(
			MalformedInputError,
		);
		await expect(createVaultSession({ vaultId: VAULT_ID, passphrase: '' })).rejects.toBeInstanceOf(
			MalformedInputError,
		);
	});
});
