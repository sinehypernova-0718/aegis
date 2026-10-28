import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const vaults = pgTable(
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

export type Vault = typeof vaults.$inferSelect;
export type NewVault = typeof vaults.$inferInsert;