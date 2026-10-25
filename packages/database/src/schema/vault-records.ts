import { customType, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
	dataType() {
		return 'bytea';
	},
});

export const vaultRecords: ReturnType<typeof pgTable> = pgTable(
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
) as unknown as ReturnType<typeof pgTable>;
