import { describe, expect, it } from 'vitest';

import { createVaultSession } from './create-vault-session.js';
import {
	RECOVERY_KEY_PREFIX,
	generateRecoveryKey,
	validateRecoveryKey,
} from './recovery-key.js';
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

describe('recovery envelope (second wrapping of the same DEK)', () => {
	it('produces an independent recovery envelope that unlocks the same vault', async () => {
		const recoveryKey = generateRecoveryKey();
		const { envelope, recoveryEnvelope, session } = await createVaultSession({
			vaultId: VAULT_ID,
			passphrase: 'correct horse battery staple',
			recoveryKey,
		});
		expect(recoveryEnvelope).toBeDefined();
		if (!recoveryEnvelope) return;
		// The recovery envelope must differ (own salt, own wrap) from the primary.
		expect(recoveryEnvelope).not.toEqual(envelope);
		expect(validateVaultKeyEnvelope(recoveryEnvelope)).toEqual(recoveryEnvelope);

		const enc = session.encryptRecord({ recordId: RECORD_ID, plaintext: encoder.encode('secret') });
		session.dispose();

		// Recovery unlock (no passphrase involvement) must decrypt the record.
		const recovered = await unlockVaultSession({
			vaultId: VAULT_ID,
			passphrase: recoveryKey,
			envelope: recoveryEnvelope,
		});
		const out = recovered.decryptRecord({
			recordId: RECORD_ID,
			encryptionVersion: enc.encryptionVersion,
			nonce: enc.nonce,
			ciphertext: enc.ciphertext,
		});
		expect(decoder.decode(out)).toBe('secret');
	});

	it('rejects a wrong recovery key with the dedicated envelope', async () => {
		const { recoveryEnvelope } = await createVaultSession({
			vaultId: VAULT_ID,
			passphrase: 'pw',
			recoveryKey: generateRecoveryKey(),
		});
		await expect(
			unlockVaultSession({
				vaultId: VAULT_ID,
				passphrase: generateRecoveryKey(), // right format, wrong KEK
				envelope: recoveryEnvelope,
			}),
		).rejects.toBeInstanceOf(AuthenticationError);
	});

	it('never produces a recovery envelope when no recovery key was supplied', async () => {
		const { recoveryEnvelope } = await createVaultSession({ vaultId: VAULT_ID, passphrase: 'pw' });
		expect(recoveryEnvelope).toBeUndefined();
	});

	it('rejects an empty recovery key', async () => {
		await expect(
			createVaultSession({ vaultId: VAULT_ID, passphrase: 'pw', recoveryKey: '' }),
		).rejects.toBeInstanceOf(MalformedInputError);
	});

	it('generates valid, unique, correctly formatted recovery keys', () => {
		const seen = new Set<string>();
		for (let index = 0; index < 32; index++) {
			const key = generateRecoveryKey();
			expect(key.startsWith(RECOVERY_KEY_PREFIX + '-')).toBe(true);
			expect(key).toMatch(/^(AEGIS-RCV-[A-Z2-7]{4}){1}(-[A-Z2-7]{4}){7}$/);
			// Validator round-trips the canonical form.
			expect(validateRecoveryKey(key)).toBe(key);
			// Retyping variants normalise to the canonical form.
			expect(validateRecoveryKey(key.toLowerCase().replaceAll('-', ' '))).toBe(key);
			expect(seen.has(key)).toBe(false);
			seen.add(key);
		}
	});

	it('rejects malformed recovery keys', () => {
		expect(() => validateRecoveryKey('')).toThrow(MalformedInputError);
		expect(() => validateRecoveryKey('AEGIS-RCV-1M2W-K4XQ-P2ZF-9QMD-3TVR-H8BC-6LWD')).toThrow(
			MalformedInputError,
		); // '1' is not in the base32 alphabet
		expect(() => validateRecoveryKey('AEGIS-RCV-7M2W-K4XQ')).toThrow(MalformedInputError);
	});
});
