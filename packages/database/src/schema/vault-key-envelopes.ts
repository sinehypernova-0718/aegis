import { sql } from 'drizzle-orm';
import {
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from 'drizzle-orm/pg-core';
import type { PgTableWithColumns } from 'drizzle-orm/pg-core';

const vaultKeyEnvelopesTable: PgTableWithColumns<{
	name: 'vault_key_envelopes';
	schema: undefined;
	columns: {
		id: { data: string; driverData: string; notNull: true; hasDefault: false; primary: true; unique: true; type: 'uuid' };
		vaultId: { data: string; driverData: string; notNull: true; hasDefault: false; primary: false; unique: false; type: 'uuid' };
		purpose: { data: string; driverData: string; notNull: true; hasDefault: false; primary: false; unique: false; type: 'text' };
		envelopeVersion: { data: number; driverData: number; notNull: true; hasDefault: false; primary: false; unique: false; type: 'integer' };
		envelope: { data: unknown; driverData: unknown; notNull: true; hasDefault: false; primary: false; unique: false; type: 'jsonb' };
		createdAt: { data: string; driverData: string; notNull: true; hasDefault: false; primary: false; unique: false; type: 'timestamp' };
		rotatedAt: { data: string | null; driverData: string | null; notNull: false; hasDefault: false; primary: false; unique: false; type: 'timestamp' };
		revokedAt: { data: string | null; driverData: string | null; notNull: false; hasDefault: false; primary: false; unique: false; type: 'timestamp' };
	};
	indexes: {
		vault_key_envelopes_vault_id_idx: { columns: ['vaultId']; unique: false };
		vault_key_envelopes_active_purpose_idx: { columns: ['vaultId', 'purpose']; unique: true };
	};
	foreignKeys: {};
}> = pgTable(
	'vault_key_envelopes',
	{
		id: uuid('id').primaryKey(),
		vaultId: uuid('vault_id').notNull(),
		purpose: text('purpose').notNull(),
		envelopeVersion: integer('envelope_version').notNull(),
		envelope: jsonb('envelope').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
		rotatedAt: timestamp('rotated_at', { withTimezone: true, mode: 'string' }),
		revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'string' }),
	},
	(table) => [
		index('vault_key_envelopes_vault_id_idx').on(table.vaultId),
		uniqueIndex('vault_key_envelopes_active_purpose_idx')
			.on(table.vaultId, table.purpose)
			.where(sql`revoked_at is null`),
	],
);

export type VaultKeyEnvelopesTable = typeof vaultKeyEnvelopesTable;

export const vaultKeyEnvelopes: VaultKeyEnvelopesTable = vaultKeyEnvelopesTable;
