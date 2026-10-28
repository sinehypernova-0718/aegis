import { eq } from 'drizzle-orm';

import { type Database } from '../client/database.js';
import { mapDatabaseError } from '../errors/database.js';
import { RecordNotFoundError } from '../errors/repository.js';
import { type NewVaultRecord, type VaultRecord, vaultRecords } from '../schema/vault-records.js';

export type { VaultRecord };

export interface VaultRecordRepository {
	createRecord(input: NewVaultRecord): Promise<VaultRecord>;
	getRecordById(id: string): Promise<VaultRecord | null>;
	updateRecord(input: VaultRecord): Promise<VaultRecord>;
	deleteRecord(id: string): Promise<void>;
}

export class DrizzleVaultRecordRepository implements VaultRecordRepository {
	constructor(private readonly database: Database) {}

	async createRecord(input: NewVaultRecord): Promise<VaultRecord> {
		try {
			const newRecord: NewVaultRecord = {
				id: input.id,
				vaultId: input.vaultId,
				recordType: input.recordType,
				encryptionVersion: input.encryptionVersion,
				nonce: input.nonce,
				ciphertext: input.ciphertext,
				createdAt: input.createdAt,
				updatedAt: input.updatedAt,
				deletedAt: input.deletedAt ?? null,
			};
			const rows = await this.database.insert(vaultRecords).values(newRecord).returning();
			const row = Array.isArray(rows) ? rows[0] : null;
			if (!row) throw new RecordNotFoundError('vault record was not created');
			return row;
		} catch (error) {
			throw mapDatabaseError(error);
		}
	}

	async getRecordById(id: string): Promise<VaultRecord | null> {
		try {
			const [row] = await this.database
				.select()
				.from(vaultRecords)
				.where(eq(vaultRecords.id, id))
				.limit(1);
			return row ?? null;
		} catch (error) {
			throw mapDatabaseError(error);
		}
	}

	async updateRecord(input: VaultRecord): Promise<VaultRecord> {
		try {
			const rows = await this.database
				.update(vaultRecords)
				.set({
					recordType: input.recordType,
					encryptionVersion: input.encryptionVersion,
					nonce: input.nonce,
					ciphertext: input.ciphertext,
					updatedAt: input.updatedAt,
					deletedAt: input.deletedAt ?? null,
				})
				.where(eq(vaultRecords.id, input.id))
				.returning();
			const row = Array.isArray(rows) ? rows[0] : null;
			if (!row) throw new RecordNotFoundError(`vault record not found: ${input.id}`);
			return row;
		} catch (error) {
			throw mapDatabaseError(error);
		}
	}

	async deleteRecord(id: string): Promise<void> {
		try {
			await this.database.delete(vaultRecords).where(eq(vaultRecords.id, id));
		} catch (error) {
			throw mapDatabaseError(error);
		}
	}
}
