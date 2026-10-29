/**
 * Credential persistence port. Opaque ciphertext + structural fields only; the
 * adapter never decrypts and never interprets the payload.
 */
export interface CredentialRecordRow {
	readonly id: string;
	readonly vaultId: string;
	readonly recordType: string;
	readonly encryptionVersion: number;
	readonly nonce: Uint8Array;
	readonly ciphertext: Uint8Array;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly deletedAt: string | null;
}

export interface NewCredentialRecordRow {
	readonly id: string;
	readonly vaultId: string;
	readonly recordType: string;
	readonly encryptionVersion: number;
	readonly nonce: Uint8Array;
	readonly ciphertext: Uint8Array;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly deletedAt: string | null;
}

export interface CredentialListOptions {
	readonly limit: number;
	readonly after?: { readonly createdAt: string; readonly id: string } | undefined;
}

export interface CredentialRepositoryPort {
	createRecord(input: NewCredentialRecordRow): Promise<CredentialRecordRow>;
	getRecordById(vaultId: string, id: string): Promise<CredentialRecordRow | null>;
	listRecordsByVault(
		vaultId: string,
		options: CredentialListOptions,
	): Promise<CredentialRecordRow[]>;
	updateRecord(input: CredentialRecordRow): Promise<CredentialRecordRow>;
	deleteRecord(vaultId: string, id: string): Promise<boolean>;
}
