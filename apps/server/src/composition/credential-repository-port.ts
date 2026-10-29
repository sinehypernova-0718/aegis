import { DrizzleVaultRecordRepository, type Database, type VaultRecord } from '@aegis/database';
import type {
	CredentialListOptions,
	CredentialRecordRow,
	CredentialRepositoryPort,
	NewCredentialRecordRow,
} from '@aegis/domain';

function toDomain(row: VaultRecord): CredentialRecordRow {
	return {
		id: row.id,
		vaultId: row.vaultId,
		recordType: row.recordType,
		encryptionVersion: row.encryptionVersion,
		nonce: row.nonce,
		ciphertext: row.ciphertext,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		deletedAt: row.deletedAt,
	};
}

/**
 * Adapts `DrizzleVaultRecordRepository` to the domain's `CredentialRepositoryPort`.
 *
 * The Drizzle insert/select types use `Buffer` and an optional `deletedAt`, which
 * do not structurally match the domain's `Uint8Array` / required-`deletedAt`
 * shapes. This adapter keeps that translation at the composition boundary and
 * keeps the domain port free of database types.
 */
export function createCredentialRepositoryPort(database: Database): CredentialRepositoryPort {
	const repository = new DrizzleVaultRecordRepository(database);
	return {
		async createRecord(input: NewCredentialRecordRow): Promise<CredentialRecordRow> {
			const row = await repository.createRecord({
				id: input.id,
				vaultId: input.vaultId,
				recordType: input.recordType,
				encryptionVersion: input.encryptionVersion,
				nonce: Buffer.from(input.nonce),
				ciphertext: Buffer.from(input.ciphertext),
				createdAt: input.createdAt,
				updatedAt: input.updatedAt,
				deletedAt: input.deletedAt,
			});
			return toDomain(row);
		},

		async getRecordById(vaultId: string, id: string): Promise<CredentialRecordRow | null> {
			const row = await repository.getRecordById(vaultId, id);
			return row ? toDomain(row) : null;
		},

		async listRecordsByVault(
			vaultId: string,
			options: CredentialListOptions,
		): Promise<CredentialRecordRow[]> {
			const rows = await repository.listRecordsByVault(vaultId, options);
			return rows.map(toDomain);
		},

		async updateRecord(input: CredentialRecordRow): Promise<CredentialRecordRow> {
			const row = await repository.updateRecord({
				id: input.id,
				vaultId: input.vaultId,
				recordType: input.recordType,
				encryptionVersion: input.encryptionVersion,
				nonce: Buffer.from(input.nonce),
				ciphertext: Buffer.from(input.ciphertext),
				createdAt: input.createdAt,
				updatedAt: input.updatedAt,
				deletedAt: input.deletedAt,
			});
			return toDomain(row);
		},

		deleteRecord(vaultId: string, id: string): Promise<boolean> {
			return repository.deleteRecord(vaultId, id);
		},
	};
}
