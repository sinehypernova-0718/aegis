import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { PgTable } from 'drizzle-orm/pg-core';

const vaultsTable: PgTable = pgTable(
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

export const vaults: PgTable = vaultsTable;

export type VaultsTable = typeof vaultsTable;
