import { clean } from '@noble/ciphers/utils';

import { validateVaultKeyEnvelope } from '../envelope/validate-envelope.js';
import { MalformedInputError } from '../errors.js';
import { deriveKek } from '../kdf/derive-key.js';
import { unwrapKey } from '../keys/wrap-key.js';
import { DefaultVaultSession, type VaultSession } from '../session/vault-session.js';
import { fromBase64Url } from '../types.js';

export interface UnlockVaultSessionInput {
	readonly vaultId: string;
	readonly passphrase: string;
	readonly envelope: unknown;
}

/**
 * Validate a persisted envelope, derive the KEK, unwrap the DEK, and return a
 * live session.
 *
 * The envelope is validated (structure, algorithms, version, KDF bounds) BEFORE
 * any Argon2id work. A wrong passphrase or tampering surfaces as
 * `AuthenticationError` from `unwrapKey`; no session is produced on any failure.
 */
export async function unlockVaultSession(input: UnlockVaultSessionInput): Promise<VaultSession> {
	if (typeof input?.vaultId !== 'string' || input.vaultId.length === 0) {
		throw new MalformedInputError('vaultId must be a non-empty string');
	}
	if (typeof input.passphrase !== 'string' || input.passphrase.length === 0) {
		throw new MalformedInputError('passphrase must be a non-empty string');
	}

	// Throws UnsupportedVersionError / EnvelopeValidationError / MalformedInputError.
	const envelope = validateVaultKeyEnvelope(input.envelope);

	const { kek } = await deriveKek({
		passphrase: input.passphrase,
		salt: fromBase64Url(envelope.kdf.salt),
		params: {
			algorithm: envelope.kdf.algorithm,
			memoryKiB: envelope.kdf.memoryKiB,
			passes: envelope.kdf.passes,
			parallelism: envelope.kdf.parallelism,
			tagLength: envelope.kdf.tagLength,
		},
	});

	let dek: Uint8Array | undefined;
	try {
		dek = unwrapKey(kek, {
			nonce: fromBase64Url(envelope.wrap.nonce),
			ciphertext: fromBase64Url(envelope.wrap.ciphertext),
		});
		return new DefaultVaultSession(input.vaultId, dek);
	} finally {
		if (dek) clean(dek);
		clean(kek);
	}
}
