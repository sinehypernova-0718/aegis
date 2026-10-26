import { customType, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { PgTable } from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
	dataType() {
		return 'bytea';
	},
});

const vaultRecordsTable: PgTable = pgTable(
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

// Use any for column types to be compatible with Drizzle's actual column types (which have getSQL method)
export type VaultRecordsTable = PgTable & {
	id: any;
	vaultId: any;
	recordType: any;
	encryptionVersion: any;
	nonce: any;
	ciphertext: any;
	createdAt: any;
	updatedAt: any;
	deletedAt: any;
};

export const vaultRecords = vaultRecordsTable as VaultRecordsTable;
