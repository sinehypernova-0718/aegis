import { customType, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { PgTableWithColumns } from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
	dataType() {
		return 'bytea';
	},
});

const vaultRecordsTable: PgTableWithColumns<{
	name: 'vault_records';
	schema: undefined;
	columns: {
		id: { data: string; driverData: string; notNull: true; hasDefault: false; primary: true; unique: true; type: 'uuid' };
		vaultId: { data: string; driverData: string; notNull: true; hasDefault: false; primary: false; unique: false; type: 'uuid' };
		recordType: { data: string; driverData: string; notNull: true; hasDefault: false; primary: false; unique: false; type: 'text' };
		encryptionVersion: { data: number; driverData: number; notNull: true; hasDefault: false; primary: false; unique: false; type: 'integer' };
		nonce: { data: Buffer; driverData: Buffer; notNull: true; hasDefault: false; primary: false; unique: false; type: 'bytea' };
		ciphertext: { data: Buffer; driverData: Buffer; notNull: true; hasDefault: false; primary: false; unique: false; type: 'bytea' };
		createdAt: { data: string; driverData: string; notNull: true; hasDefault: false; primary: false; unique: false; type: 'timestamp' };
		updatedAt: { data: string; driverData: string; notNull: true; hasDefault: false; primary: false; unique: false; type: 'timestamp' };
		deletedAt: { data: string | null; driverData: string | null; notNull: false; hasDefault: false; primary: false; unique: false; type: 'timestamp' };
	};
	indexes: {
		vault_records_vault_id_idx: { columns: ['vaultId']; unique: false };
		vault_records_vault_type_idx: { columns: ['vaultId', 'recordType']; unique: false };
		vault_records_created_at_idx: { columns: ['createdAt']; unique: false };
	};
	foreignKeys: {};
}> = pgTable(
	'vault_records',
	{
		id: uuid('id').primaryKey(),
		vaultId: uuid('vault_id').notNull(),
		recordType: text('record_type').notNull(),
		encryptionVersion: integer('encryption_version').notNull(),
		nonce: bytea('nonce').notNull(),
		ciphertext: bytea('ciphertext').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
		deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
	},
	(table) => [
		index('vault_records_vault_id_idx').on(table.vaultId),
		index('vault_records_vault_type_idx').on(table.vaultId, table.recordType),
		index('vault_records_created_at_idx').on(table.createdAt),
	],
);

export type VaultRecordsTable = typeof vaultRecordsTable;

export const vaultRecords: VaultRecordsTable = vaultRecordsTable;
