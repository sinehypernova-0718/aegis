import type { VaultKeyEnvelope, VaultSession } from '@aegis/crypto';

/**
 * Narrow behaviour port over `@aegis/crypto`.
 *
 * The domain orchestrates vault key material through this port and never touches
 * a DEK/KEK. The composition root supplies a real adapter; unit tests supply a
 * fake so they never run Argon2id.
 */
export interface CreateVaultSessionRequest {
	readonly vaultId: string;
	readonly passphrase: string;
}

export interface UnlockVaultSessionRequest {
	readonly vaultId: string;
	readonly passphrase: string;
	readonly envelope: unknown;
}

export interface VaultCryptoPort {
	createVaultSession(
		input: CreateVaultSessionRequest,
	): Promise<{ envelope: VaultKeyEnvelope; session: VaultSession }>;
	unlockVaultSession(input: UnlockVaultSessionRequest): Promise<VaultSession>;
	validateEnvelope(input: unknown): VaultKeyEnvelope;
}
