import { clean } from '@noble/ciphers/utils';

import { createVaultKeyEnvelope } from '../envelope/schema.js';
import { validateVaultKeyEnvelope } from '../envelope/validate-envelope.js';
import { MalformedInputError } from '../errors.js';
import { deriveKek } from '../kdf/derive-key.js';
import { generateDek } from '../keys/generate-dek.js';
import { wrapKey } from '../keys/wrap-key.js';
import type { RecoveryKey } from './recovery-key.js';
import { DefaultVaultSession, type VaultSession } from '../session/vault-session.js';
import type { VaultKeyEnvelope } from '../types.js';

export interface CreateVaultSessionInput {
	readonly vaultId: string;
	readonly passphrase: string;
	/**
	 * Optional emergency recovery factor. When supplied, the SAME DEK is
	 * additionally wrapped under a KEK derived (independently, own salt +
	 * params) from the recovery key, producing a second envelope for a separate
	 * `recovery` purpose row. The raw recovery key is never logged or stored.
	 */
	readonly recoveryKey?: RecoveryKey | string;
}

export interface CreatedVaultSession {
	readonly envelope: VaultKeyEnvelope;
	readonly session: VaultSession;
	/** Present only when a recovery key was supplied to creation. */
	readonly recoveryEnvelope?: VaultKeyEnvelope;
}

/**
 * Create fresh vault key material and return the persisted envelope(s)
 * together with a live, opaque session.
 *
 * The raw DEK is retained only inside the returned session; the KEKs and the
 * local DEK copy are wiped best-effort before returning.
 */
export async function createVaultSession(
	input: CreateVaultSessionInput,
): Promise<CreatedVaultSession> {
	if (typeof input?.vaultId !== 'string' || input.vaultId.length === 0) {
		throw new MalformedInputError('vaultId must be a non-empty string');
	}
	if (typeof input.passphrase !== 'string' || input.passphrase.length === 0) {
		throw new MalformedInputError('passphrase must be a non-empty string');
	}
	const recoveryKey = input.recoveryKey;
	if (recoveryKey !== undefined && (typeof recoveryKey !== 'string' || recoveryKey.length === 0)) {
		throw new MalformedInputError('recovery key must be a non-empty string');
	}

	// Independent KDF derivations, one per wrapping factor.
	const primary = await deriveKek({ passphrase: input.passphrase });
	const recovery = recoveryKey === undefined ? null : await deriveKek({ passphrase: recoveryKey });

	let dek: Uint8Array | undefined;
	try {
		dek = generateDek();
		const wrapped = wrapKey(primary.kek, dek);
		const envelope = createVaultKeyEnvelope({
			salt: primary.salt,
			params: {
				memoryKiB: primary.params.memoryKiB,
				passes: primary.params.passes,
				parallelism: primary.params.parallelism,
				tagLength: primary.params.tagLength,
			},
			wrapped,
		});
		// Validate the assembled envelopes before handing them out.
		validateVaultKeyEnvelope(envelope);

		let recoveryEnvelope: VaultKeyEnvelope | undefined;
		if (recovery !== null) {
			const recoveryWrapped = wrapKey(recovery.kek, dek);
			recoveryEnvelope = createVaultKeyEnvelope({
				salt: recovery.salt,
				params: {
					memoryKiB: recovery.params.memoryKiB,
					passes: recovery.params.passes,
					parallelism: recovery.params.parallelism,
					tagLength: recovery.params.tagLength,
				},
				wrapped: recoveryWrapped,
			});
			validateVaultKeyEnvelope(recoveryEnvelope);
		}

		const session = new DefaultVaultSession(input.vaultId, dek);
		return { envelope, session, ...(recoveryEnvelope ? { recoveryEnvelope } : {}) };
	} finally {
		if (dek) clean(dek);
		clean(primary.kek);
		if (recovery !== null) clean(recovery.kek);
	}
}
