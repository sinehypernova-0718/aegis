import {
	type VaultKeyEnvelope,
	type VaultSession,
	createVaultSession,
	unlockVaultSession,
	validateVaultKeyEnvelope,
} from '@aegis/crypto';
import type { VaultCryptoPort } from '@aegis/domain';

/**
 * Adapts the narrowed `@aegis/crypto` public API to the domain's `VaultCryptoPort`.
 *
 * The `VaultSession` returned by crypto is handed to the domain unchanged and
 * opaque; the domain never sees raw key bytes. This is the only place in the
 * application that imports crypto's session API.
 */
export function createCryptoVaultPort(): VaultCryptoPort {
	return {
		createVaultSession: async (input: { vaultId: string; passphrase: string }) => {
			const { envelope, session } = await createVaultSession(input);
			return { envelope, session };
		},
		unlockVaultSession: (input: {
			vaultId: string;
			passphrase: string;
			envelope: unknown;
		}): Promise<VaultSession> => unlockVaultSession(input),
		validateEnvelope: (input: unknown): VaultKeyEnvelope => validateVaultKeyEnvelope(input),
	};
}
