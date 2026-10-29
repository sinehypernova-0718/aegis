import { and, desc, eq, isNull } from 'drizzle-orm';

import { type Database } from '../client/database.js';
import { mapDatabaseError } from '../errors/database.js';
import { RecordNotFoundError } from '../errors/repository.js';
import {
	type NewVaultKeyEnvelope,
	type VaultKeyEnvelope,
	vaultKeyEnvelopes,
} from '../schema/vault-key-envelopes.js';
import { type NewVault, type Vault, vaults } from '../schema/vaults.js';
import { withDatabaseTransaction } from '../transactions/index.js';

export interface CreateVaultInput {
	id: string;
	status: string;
	encryptionFormatVersion: number;
	createdAt: string;
	updatedAt: string;
}

export interface CreateVaultKeyEnvelopeInput {
	id: string;
	vaultId: string;
	purpose: string;
	envelopeVersion: number;
	envelope: unknown;
	createdAt: string;
	rotatedAt?: string | null;
	revokedAt?: string | null;
}

export interface VaultRepository {
	createVault(input: CreateVaultInput): Promise<Vault>;
	getVaultById(id: string): Promise<Vault | null>;
	updateVaultStatus(id: string, status: string, updatedAt: string): Promise<Vault>;
	/** Returns the single eligible (non-revoked) envelope for a vault + purpose. */
	getActiveKeyEnvelope(vaultId: string, purpose: string): Promise<VaultKeyEnvelope | null>;
	initializeVaultWithKeyEnvelopes(
		vault: CreateVaultInput,
		envelopes: readonly CreateVaultKeyEnvelopeInput[],
	): Promise<Vault>;
}

export class DrizzleVaultRepository implements VaultRepository {
	constructor(private readonly database: Database) {}

	async createVault(input: CreateVaultInput): Promise<Vault> {
		try {
			const newVault: NewVault = {
				id: input.id,
				status: input.status,
				encryptionFormatVersion: input.encryptionFormatVersion,
				createdAt: input.createdAt,
				updatedAt: input.updatedAt,
			};
			const rows = await this.database.insert(vaults).values(newVault).returning();
			const row = Array.isArray(rows) ? rows[0] : null;
			if (!row) throw new RecordNotFoundError('vault record was not created');
			return row;
		} catch (error) {
			throw mapDatabaseError(error);
		}
	}

	async getVaultById(id: string): Promise<Vault | null> {
		try {
			const rows = await this.database.select().from(vaults).where(eq(vaults.id, id)).limit(1);
			const row = Array.isArray(rows) ? rows[0] : null;
			return row ?? null;
		} catch (error) {
			throw mapDatabaseError(error);
		}
	}

	async updateVaultStatus(id: string, status: string, updatedAt: string): Promise<Vault> {
		try {
			const rows = await this.database
				.update(vaults)
				.set({ status, updatedAt })
				.where(eq(vaults.id, id))
				.returning();
			const row = Array.isArray(rows) ? rows[0] : null;
			if (!row) throw new RecordNotFoundError(`vault not found: ${id}`);
			return row;
		} catch (error) {
			throw mapDatabaseError(error);
		}
	}

	async getActiveKeyEnvelope(vaultId: string, purpose: string): Promise<VaultKeyEnvelope | null> {
		try {
			const rows = await this.database
				.select()
				.from(vaultKeyEnvelopes)
				.where(
					and(
						eq(vaultKeyEnvelopes.vaultId, vaultId),
						eq(vaultKeyEnvelopes.purpose, purpose),
						isNull(vaultKeyEnvelopes.revokedAt),
					),
				)
				.orderBy(desc(vaultKeyEnvelopes.createdAt))
				.limit(1);
			const row = rows[0];
			return row ?? null;
		} catch (error) {
			throw mapDatabaseError(error);
		}
	}

	async initializeVaultWithKeyEnvelopes(
		vault: CreateVaultInput,
		envelopes: readonly CreateVaultKeyEnvelopeInput[],
	): Promise<Vault> {
		if (envelopes.length === 0) {
			throw new TypeError('vault initialization requires at least one key envelope');
		}
		for (const envelope of envelopes) {
			if (envelope.vaultId !== vault.id) {
				throw new TypeError(`key envelope does not belong to vault ${vault.id}`);
			}
		}
		try {
			return await withDatabaseTransaction(this.database, async (transaction) => {
				const newVault: NewVault = {
					id: vault.id,
					status: vault.status,
					encryptionFormatVersion: vault.encryptionFormatVersion,
					createdAt: vault.createdAt,
					updatedAt: vault.updatedAt,
				};
				const vaultRows = await transaction.insert(vaults).values(newVault).returning();
				const vaultRow = Array.isArray(vaultRows) ? vaultRows[0] : null;
				if (!vaultRow) throw new RecordNotFoundError('vault record was not created');

				const newEnvelopes: NewVaultKeyEnvelope[] = envelopes.map((envelope) => ({
					id: envelope.id,
					vaultId: envelope.vaultId,
					purpose: envelope.purpose,
					envelopeVersion: envelope.envelopeVersion,
					envelope: envelope.envelope,
					createdAt: envelope.createdAt,
					rotatedAt: envelope.rotatedAt ?? null,
					revokedAt: envelope.revokedAt ?? null,
				}));

				for (const envelope of newEnvelopes) {
					await transaction.insert(vaultKeyEnvelopes).values(envelope);
				}

				return vaultRow;
			});
		} catch (error) {
			throw mapDatabaseError(error);
		}
	}
}
