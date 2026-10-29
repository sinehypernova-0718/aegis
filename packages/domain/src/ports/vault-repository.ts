/**
 * Vault persistence port.
 *
 * Implemented structurally by `DrizzleVaultRepository`; the composition root
 * injects the concrete instance. The domain never imports `@aegis/database`.
 */
export interface VaultState {
	readonly id: string;
	readonly status: string;
	readonly encryptionFormatVersion: number;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface NewVaultState {
	readonly id: string;
	readonly status: string;
	readonly encryptionFormatVersion: number;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface PersistedKeyEnvelope {
	readonly id: string;
	readonly vaultId: string;
	readonly purpose: string;
	readonly envelopeVersion: number;
	readonly envelope: unknown;
	readonly createdAt: string;
}

export interface NewPersistedKeyEnvelope {
	readonly id: string;
	readonly vaultId: string;
	readonly purpose: string;
	readonly envelopeVersion: number;
	readonly envelope: unknown;
	readonly createdAt: string;
}

export interface VaultRepositoryPort {
	getVaultById(id: string): Promise<VaultState | null>;
	initializeVaultWithKeyEnvelopes(
		vault: NewVaultState,
		envelopes: readonly NewPersistedKeyEnvelope[],
	): Promise<VaultState>;
	getActiveKeyEnvelope(vaultId: string, purpose: string): Promise<PersistedKeyEnvelope | null>;
}
