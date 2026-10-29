import { clean } from '@noble/ciphers/utils';

import { createVaultKeyEnvelope } from '../envelope/schema.js';
import { validateVaultKeyEnvelope } from '../envelope/validate-envelope.js';
import { MalformedInputError } from '../errors.js';
import { deriveKek } from '../kdf/derive-key.js';
import { generateDek } from '../keys/generate-dek.js';
import { wrapKey } from '../keys/wrap-key.js';
import { DefaultVaultSession, type VaultSession } from '../session/vault-session.js';
import type { VaultKeyEnvelope } from '../types.js';

export interface CreateVaultSessionInput {
	readonly vaultId: string;
	readonly passphrase: string;
}

export interface CreatedVaultSession {
	readonly envelope: VaultKeyEnvelope;
	readonly session: VaultSession;
}

/**
 * Create fresh vault key material and return the persisted envelope together
 * with a live, opaque session.
 *
 * The raw DEK is retained only inside the returned session; the KEK and the
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

	const { kek, salt, params } = await deriveKek({ passphrase: input.passphrase });

	let dek: Uint8Array | undefined;
	try {
		dek = generateDek();
		const wrapped = wrapKey(kek, dek);
		const envelope = createVaultKeyEnvelope({
			salt,
			params: {
				memoryKiB: params.memoryKiB,
				passes: params.passes,
				parallelism: params.parallelism,
				tagLength: params.tagLength,
			},
			wrapped,
		});
		// Validate the assembled envelope before handing it out.
		validateVaultKeyEnvelope(envelope);
		const session = new DefaultVaultSession(input.vaultId, dek);
		return { envelope, session };
	} finally {
		if (dek) clean(dek);
		clean(kek);
	}
}
