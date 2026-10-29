import { and, asc, eq, gt, or } from 'drizzle-orm';

import { type Database } from '../client/database.js';
import { mapDatabaseError } from '../errors/database.js';
import { RecordNotFoundError } from '../errors/repository.js';
import { type NewVaultRecord, type VaultRecord, vaultRecords } from '../schema/vault-records.js';

export type { VaultRecord };

export interface RecordListCursor {
	readonly createdAt: string;
	readonly id: string;
}

export interface ListRecordsOptions {
	readonly limit: number;
	readonly after?: RecordListCursor | undefined;
}

export interface VaultRecordRepository {
	createRecord(input: NewVaultRecord): Promise<VaultRecord>;
	/** Vault-scoped read: both vault id and record id must match. */
	getRecordById(vaultId: string, id: string): Promise<VaultRecord | null>;
	/** Bounded, deterministic keyset listing scoped to a vault. */
	listRecordsByVault(vaultId: string, options: ListRecordsOptions): Promise<VaultRecord[]>;
	/** Vault-scoped update; the row's `vaultId` and `id` both constrain the write. */
	updateRecord(input: VaultRecord): Promise<VaultRecord>;
	/** Physical, vault-scoped delete. Returns whether a row was removed. */
	deleteRecord(vaultId: string, id: string): Promise<boolean>;
}

/**
 * Normalize a database timestamp to canonical ISO-8601 UTC with millisecond
 * precision. Idempotent for already-canonical values. This keeps repository
 * output aligned with `@aegis/contracts`' `IsoUtcTimestamp` shape regardless of
 * the exact string form the pg driver returns for `timestamptz`.
 */
function toCanonicalIso(value: string): string {
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return value;
	return parsed.toISOString();
}

function normalizeRecord(row: VaultRecord): VaultRecord {
	return {
		...row,
		createdAt: toCanonicalIso(row.createdAt),
		updatedAt: toCanonicalIso(row.updatedAt),
		deletedAt: row.deletedAt === null ? null : toCanonicalIso(row.deletedAt),
	};
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
			return normalizeRecord(row);
		} catch (error) {
			throw mapDatabaseError(error);
		}
	}

	async getRecordById(vaultId: string, id: string): Promise<VaultRecord | null> {
		try {
			const rows = await this.database
				.select()
				.from(vaultRecords)
				.where(and(eq(vaultRecords.vaultId, vaultId), eq(vaultRecords.id, id)))
				.limit(1);
			const row = rows[0];
			return row ? normalizeRecord(row) : null;
		} catch (error) {
			throw mapDatabaseError(error);
		}
	}

	async listRecordsByVault(vaultId: string, options: ListRecordsOptions): Promise<VaultRecord[]> {
		try {
			const after = options.after;
			const where = after
				? and(
						eq(vaultRecords.vaultId, vaultId),
						or(
							gt(vaultRecords.createdAt, after.createdAt),
							and(eq(vaultRecords.createdAt, after.createdAt), gt(vaultRecords.id, after.id)),
						),
					)
				: eq(vaultRecords.vaultId, vaultId);
			const rows = await this.database
				.select()
				.from(vaultRecords)
				.where(where)
				.orderBy(asc(vaultRecords.createdAt), asc(vaultRecords.id))
				.limit(options.limit);
			return rows.map(normalizeRecord);
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
				.where(and(eq(vaultRecords.vaultId, input.vaultId), eq(vaultRecords.id, input.id)))
				.returning();
			const row = Array.isArray(rows) ? rows[0] : null;
			if (!row) throw new RecordNotFoundError(`vault record not found: ${input.id}`);
			return normalizeRecord(row);
		} catch (error) {
			throw mapDatabaseError(error);
		}
	}

	async deleteRecord(vaultId: string, id: string): Promise<boolean> {
		try {
			const rows = await this.database
				.delete(vaultRecords)
				.where(and(eq(vaultRecords.vaultId, vaultId), eq(vaultRecords.id, id)))
				.returning({ id: vaultRecords.id });
			return Array.isArray(rows) && rows.length > 0;
		} catch (error) {
			throw mapDatabaseError(error);
		}
	}
}
