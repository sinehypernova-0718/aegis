import { eq } from 'drizzle-orm';

import { type Database } from '../client/database.js';
import { mapDatabaseError } from '../errors/database.js';
import { RecordNotFoundError } from '../errors/repository.js';
import { vaultRecords } from '../schema/vault-records.js';

export interface VaultRecord {
	id: string;
	vaultId: string;
	recordType: string;
	encryptionVersion: number;
	nonce: Buffer;
	ciphertext: Buffer;
	createdAt: string;
	updatedAt: string;
	deletedAt?: string | null;
}

export interface VaultRecordRepository {
	createRecord(input: VaultRecord): Promise<VaultRecord>;
	getRecordById(id: string): Promise<VaultRecord | null>;
	updateRecord(input: VaultRecord): Promise<VaultRecord>;
	deleteRecord(id: string): Promise<void>;
}

export class DrizzleVaultRecordRepository implements VaultRecordRepository {
	constructor(private readonly database: Database) {}

	async createRecord(input: VaultRecord): Promise<VaultRecord> {
		try {
			const rows = await this.database
				.insert(vaultRecords as any)
				.values({
					id: input.id,
					vaultId: input.vaultId,
					recordType: input.recordType,
					encryptionVersion: input.encryptionVersion,
					nonce: input.nonce,
					ciphertext: input.ciphertext,
					createdAt: input.createdAt,
					updatedAt: input.updatedAt,
					deletedAt: input.deletedAt ?? null,
				})
				.returning();
			const row = Array.isArray(rows) ? rows[0] : null;
			if (!row) throw new RecordNotFoundError('vault record was not created');
			return mapVaultRecord(row);
		} catch (error) {
			throw mapDatabaseError(error);
		}
	}

	async getRecordById(id: string): Promise<VaultRecord | null> {
		const [row] = await this.database
			.select()
			.from(vaultRecords as any)
			.where(eq(vaultRecords.id as any, id))
			.limit(1);
		return row ? mapVaultRecord(row) : null;
	}

	async updateRecord(input: VaultRecord): Promise<VaultRecord> {
		try {
			const rows = await this.database
				.update(vaultRecords as any)
				.set({
					recordType: input.recordType,
					encryptionVersion: input.encryptionVersion,
					nonce: input.nonce,
					ciphertext: input.ciphertext,
					updatedAt: input.updatedAt,
					deletedAt: input.deletedAt ?? null,
				})
				.where(eq(vaultRecords.id as any, input.id))
				.returning();
			const row = Array.isArray(rows) ? rows[0] : null;
			if (!row) throw new RecordNotFoundError(`vault record not found: ${input.id}`);
			return mapVaultRecord(row);
		} catch (error) {
			throw mapDatabaseError(error);
		}
	}

	async deleteRecord(id: string): Promise<void> {
		await this.database.delete(vaultRecords as any).where(eq(vaultRecords.id as any, id));
	}
}

function mapVaultRecord(row: unknown): VaultRecord {
	const source = row as Record<string, unknown>;
	return {
		id: String(source.id),
		vaultId: String(source.vaultId),
		recordType: String(source.recordType),
		encryptionVersion: Number(source.encryptionVersion),
		nonce: source.nonce as Buffer,
		ciphertext: source.ciphertext as Buffer,
		createdAt: String(source.createdAt),
		updatedAt: String(source.updatedAt),
		deletedAt: source.deletedAt === null ? null : String(source.deletedAt),
	};
}
