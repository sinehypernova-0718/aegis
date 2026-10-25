import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

const vaultsInternal = pgTable(
	'vaults',
	{
		id: uuid('id').primaryKey(),
		status: text('status').notNull(),
		encryptionFormatVersion: integer('encryption_format_version').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
	},
	(table) => [index('vaults_status_idx').on(table.status)],
);

export function vaults(): typeof vaultsInternal {
	return vaultsInternal;
}
