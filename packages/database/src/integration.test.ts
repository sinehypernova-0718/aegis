import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import {
	createDatabaseClient,
	DrizzleVaultRecordRepository,
	DrizzleVaultRepository,
	UniqueConstraintViolationError,
	withDatabaseTransaction,
} from '../src/index.js';

import { vaults } from '../src/schema/vaults.js';

const databaseUrl = process.env.DATABASE_URL;
describe.skipIf(!databaseUrl)('PostgreSQL repository behavior', () => {
	it('creates and reads a vault with required key envelopes', async () => {
		const client = createDatabaseClient({ connectionString: databaseUrl as string });
		try {
			const repository = new DrizzleVaultRepository(client.database);
			const now = new Date().toISOString();
			const vaultId = randomUUID();
			const vault = await repository.initializeVaultWithKeyEnvelopes(
				{
					id: vaultId,
					status: 'active',
					encryptionFormatVersion: 1,
					createdAt: now,
					updatedAt: now,
				},
				[
					{
						id: randomUUID(),
						vaultId,
						purpose: 'primary_windows',
						envelopeVersion: 1,
						envelope: { version: 1 },
						createdAt: now,
					},
				],
			);

			expect(await repository.getVaultById(vault.id)).toMatchObject({
				id: vault.id,
				status: 'active',
			});

			await repository.updateVaultStatus(vault.id, 'locked', now);
			expect(await repository.getVaultById(vault.id)).toMatchObject({ status: 'locked' });
		} finally {
			await client.close();
		}
	});

	it('rejects vault initialization without envelopes', async () => {
		const client = createDatabaseClient({ connectionString: databaseUrl as string });
		try {
			const repository = new DrizzleVaultRepository(client.database);
			await expect(
				repository.initializeVaultWithKeyEnvelopes(
					{
						id: randomUUID(),
						status: 'active',
						encryptionFormatVersion: 1,
						createdAt: new Date().toISOString(),
						updatedAt: new Date().toISOString(),
					},
					[],
				),
			).rejects.toBeInstanceOf(TypeError);
		} finally {
			await client.close();
		}
	});

	it('maps a unique envelope conflict to a stable error', async () => {
		const client = createDatabaseClient({ connectionString: databaseUrl as string });
		try {
			const repository = new DrizzleVaultRepository(client.database);
			const now = new Date().toISOString();
			const vaultId = randomUUID();
			const envelopeId = randomUUID();
			await repository.initializeVaultWithKeyEnvelopes(
				{
					id: vaultId,
					status: 'active',
					encryptionFormatVersion: 1,
					createdAt: now,
					updatedAt: now,
				},
				[
					{
						id: envelopeId,
						vaultId,
						purpose: 'primary_windows',
						envelopeVersion: 1,
						envelope: { version: 1 },
						createdAt: now,
					},
				],
			);

			await expect(
				repository.initializeVaultWithKeyEnvelopes(
					{
						id: randomUUID(),
						status: 'active',
						encryptionFormatVersion: 1,
						createdAt: now,
						updatedAt: now,
					},
					[
						{
							id: envelopeId,
							vaultId: randomUUID(),
							purpose: 'primary_windows',
							envelopeVersion: 1,
							envelope: { version: 1 },
							createdAt: now,
						},
					],
				),
			).rejects.toBeInstanceOf(UniqueConstraintViolationError);
		} finally {
			await client.close();
		}
	});

	it('supports encrypted record CRUD and not-found handling', async () => {
		const client = createDatabaseClient({ connectionString: databaseUrl as string });
		try {
			const vaultRepository = new DrizzleVaultRepository(client.database);
			const recordRepository = new DrizzleVaultRecordRepository(client.database);
			const now = new Date().toISOString();
			const vaultId = randomUUID();
			await vaultRepository.initializeVaultWithKeyEnvelopes(
				{
					id: vaultId,
					status: 'active',
					encryptionFormatVersion: 1,
					createdAt: now,
					updatedAt: now,
				},
				[
					{
						id: randomUUID(),
						vaultId,
						purpose: 'primary_windows',
						envelopeVersion: 1,
						envelope: { version: 1 },
						createdAt: now,
					},
				],
			);

			const nonce = Buffer.from('nonce');
			const ciphertext = Buffer.from('ciphertext');
			const record = await recordRepository.createRecord({
				id: randomUUID(),
				vaultId,
				recordType: 'credential',
				encryptionVersion: 1,
				nonce,
				ciphertext,
				createdAt: now,
				updatedAt: now,
			});

			expect(await recordRepository.getRecordById(record.id)).toMatchObject({
				id: record.id,
				vaultId,
				recordType: 'credential',
			});

			await expect(recordRepository.getRecordById(randomUUID())).resolves.toBeNull();
			await recordRepository.deleteRecord(record.id);
		} finally {
			await client.close();
		}
	});
});

describe.skipIf(!databaseUrl)('PostgreSQL transaction rollback', () => {
	it('rolls back a vault insert when an operation fails after the insert', async () => {
		const client = createDatabaseClient({ connectionString: databaseUrl as string });
		try {
			const now = new Date().toISOString();
			const vaultId = randomUUID();
			await expect(
				withDatabaseTransaction(client.database, async (transaction) => {
					await transaction
						.insert(vaults)
						.values({
							id: vaultId,
							status: 'active',
							encryptionFormatVersion: 1,
							createdAt: now,
							updatedAt: now,
						})
						.returning();
					throw new Error('forced transaction failure');
				}),
			).rejects.toThrow('forced transaction failure');

			const rows = await client.database.select().from(vaults).where(eq(vaults.id!, vaultId));
			expect(rows).toHaveLength(0);
		} finally {
			await client.close();
		}
	});
});
