import type { PgTable } from 'drizzle-orm/pg-core';
import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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

// Use any for column types to be compatible with Drizzle's actual column types (which have getSQL method)
export type VaultsTable = PgTable & {
	id: any;
	status: any;
	encryptionFormatVersion: any;
	createdAt: any;
	updatedAt: any;
};

export const vaults = vaultsTable as VaultsTable;
