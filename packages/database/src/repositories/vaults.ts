import { eq } from 'drizzle-orm';

import { type Database } from '../client/database.js';
import { mapDatabaseError } from '../errors/database.js';
import { RecordNotFoundError, UniqueConstraintViolationError } from '../errors/repository.js';
import { vaultKeyEnvelopes } from '../schema/vault-key-envelopes.js';
import { vaults } from '../schema/vaults.js';
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
	createVault(input: CreateVaultInput): Promise<CreateVaultInput>;
	getVaultById(id: string): Promise<CreateVaultInput | null>;
	updateVaultStatus(id: string, status: string, updatedAt: string): Promise<CreateVaultInput>;
	initializeVaultWithKeyEnvelopes(
		vault: CreateVaultInput,
		envelopes: readonly CreateVaultKeyEnvelopeInput[],
	): Promise<CreateVaultInput>;
}

export class DrizzleVaultRepository implements VaultRepository {
	constructor(private readonly database: Database) {}

	async createVault(input: CreateVaultInput): Promise<CreateVaultInput> {
		try {
			const rows = await this.database
				.insert(vaults)
				.values({
					id: input.id,
					status: input.status,
					encryptionFormatVersion: input.encryptionFormatVersion,
					createdAt: input.createdAt,
					updatedAt: input.updatedAt,
				})
				.returning();
			const row = Array.isArray(rows) ? rows[0] : null;
			if (!row) throw new RecordNotFoundError('vault record was not created');
			return mapVaultRow(row);
		} catch (error) {
			throw mapDatabaseError(error);
		}
	}

	async getVaultById(id: string): Promise<CreateVaultInput | null> {
		try {
			const rows = await this.database
				.select()
				.from(vaults)
				.where(eq(vaults.id, id))
				.limit(1);
			const row = Array.isArray(rows) ? rows[0] : null;
			return row ? mapVaultRow(row) : null;
		} catch (error) {
			throw mapDatabaseError(error);
		}
	}

	async updateVaultStatus(
		id: string,
		status: string,
		updatedAt: string,
	): Promise<CreateVaultInput> {
		try {
			const rows = await this.database
				.update(vaults)
				.set({ status, updatedAt })
				.where(eq(vaults.id, id))
				.returning();
			const row = Array.isArray(rows) ? rows[0] : null;
			if (!row) throw new RecordNotFoundError(`vault not found: ${id}`);
			return mapVaultRow(row);
		} catch (error) {
			throw mapDatabaseError(error);
		}
	}

	async initializeVaultWithKeyEnvelopes(
		vault: CreateVaultInput,
		envelopes: readonly CreateVaultKeyEnvelopeInput[],
	): Promise<CreateVaultInput> {
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
				const vaultRows = await transaction
					.insert(vaults)
					.values({
						id: vault.id,
						status: vault.status,
						encryptionFormatVersion: vault.encryptionFormatVersion,
						createdAt: vault.createdAt,
						updatedAt: vault.updatedAt,
					})
					.returning();
				const vaultRow = Array.isArray(vaultRows) ? vaultRows[0] : null;
				if (!vaultRow) throw new RecordNotFoundError('vault record was not created');

				for (const envelope of envelopes) {
					await transaction
						.insert(vaultKeyEnvelopes)
						.values({
							id: envelope.id,
							vaultId: envelope.vaultId,
							purpose: envelope.purpose,
							envelopeVersion: envelope.envelopeVersion,
							envelope: envelope.envelope,
							createdAt: envelope.createdAt,
							rotatedAt: envelope.rotatedAt ?? null,
							revokedAt: envelope.revokedAt ?? null,
						});
				}

				return mapVaultRow(vaultRow);
			});
		} catch (error) {
			throw mapDatabaseError(error);
		}
	}
}

function mapVaultRow(row: unknown): CreateVaultInput {
	const source = row as Record<string, unknown>;
	return {
		id: String(source.id),
		status: String(source.status),
		encryptionFormatVersion: Number(source.encryptionFormatVersion),
		createdAt: String(source.createdAt),
		updatedAt: String(source.updatedAt),
	};
}
