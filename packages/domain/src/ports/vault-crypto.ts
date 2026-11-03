export interface VaultKeyEnvelope {
	readonly version: number;
}

export interface EncryptedRecord {
	readonly encryptionVersion: number;
	readonly nonce: Uint8Array;
	readonly ciphertext: Uint8Array;
}

export interface VaultSession {
	readonly vaultId: string;
	readonly isDisposed: boolean;
	encryptRecord(input: {
		readonly recordId: string;
		readonly plaintext: Uint8Array;
	}): EncryptedRecord;
	decryptRecord(input: {
		readonly recordId: string;
		readonly encryptionVersion: number;
		readonly nonce: Uint8Array;
		readonly ciphertext: Uint8Array;
	}): Uint8Array;
	dispose(): void;
}

/**
 * Narrow behavior port implemented by the composition-supplied crypto adapter.
 *
 * The domain orchestrates vault key material through this port and never touches
 * a DEK/KEK. The composition root supplies a real adapter; unit tests supply a
 * fake so they never run Argon2id.
 */
export interface CreateVaultSessionRequest {
	readonly vaultId: string;
	readonly passphrase: string;
	/** Emergency recovery factor; presence requests a second (`recovery`) envelope. */
	readonly recoveryKey?: string;
}

export interface UnlockVaultSessionRequest {
	readonly vaultId: string;
	/** Master passphrase for the primary envelope, or the recovery key for the recovery envelope. */
	readonly passphrase: string;
	readonly envelope: unknown;
}

export interface CreatedVaultSession {
	readonly envelope: VaultKeyEnvelope;
	readonly session: VaultSession;
	/** Present only when a recovery key was supplied to creation. */
	readonly recoveryEnvelope?: VaultKeyEnvelope;
}

export interface VaultCryptoPort {
	/** Generate a fresh, human-transcribable emergency recovery key (shown once). */
	generateRecoveryKey(): string;
	createVaultSession(input: CreateVaultSessionRequest): Promise<CreatedVaultSession>;
	unlockVaultSession(input: UnlockVaultSessionRequest): Promise<VaultSession>;
	validateEnvelope(input: unknown): void;
}
