import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { PgTableWithColumns } from 'drizzle-orm/pg-core';

const vaultsTable: PgTableWithColumns<{
	name: 'vaults';
	schema: undefined;
	columns: {
		id: { data: string; driverData: string; notNull: true; hasDefault: false; primary: true; unique: true; type: 'uuid' };
		status: { data: string; driverData: string; notNull: true; hasDefault: false; primary: false; unique: false; type: 'text' };
		encryptionFormatVersion: { data: number; driverData: number; notNull: true; hasDefault: false; primary: false; unique: false; type: 'integer' };
		createdAt: { data: string; driverData: string; notNull: true; hasDefault: false; primary: false; unique: false; type: 'timestamp' };
		updatedAt: { data: string; driverData: string; notNull: true; hasDefault: false; primary: false; unique: false; type: 'timestamp' };
	};
	indexes: {
		vaults_status_idx: { columns: ['status']; unique: false };
	};
	foreignKeys: {};
}> = pgTable(
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

export type VaultsTable = typeof vaultsTable;

export const vaults: VaultsTable = vaultsTable;
