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

import { vaults } from './vaults.js';

export const vaultKeyEnvelopes = pgTable(
	'vault_key_envelopes',
	{
		id: uuid('id').primaryKey(),
		vaultId: uuid('vault_id')
			.notNull()
			.references(() => vaults.id, { onDelete: 'cascade' }),
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

export type VaultKeyEnvelope = typeof vaultKeyEnvelopes.$inferSelect;
export type NewVaultKeyEnvelope = typeof vaultKeyEnvelopes.$inferInsert;
