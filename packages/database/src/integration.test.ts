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

const VAULT_PURPOSE = 'primary';

function baseVault() {
	const now = new Date().toISOString();
	return {
		id: randomUUID(),
		status: 'initialized',
		encryptionFormatVersion: 1,
		createdAt: now,
		updatedAt: now,
	};
}

function envelope(vaultId: string, purpose = VAULT_PURPOSE, revokedAt: string | null = null) {
	const now = new Date().toISOString();
	return {
		id: randomUUID(),
		vaultId,
		purpose,
		envelopeVersion: 1,
		envelope: { version: 1 },
		createdAt: now,
		revokedAt,
	};
}

describe.skipIf(!databaseUrl)('PostgreSQL repository behavior', () => {
	it('creates and reads a vault with required key envelopes', async () => {
		const client = createDatabaseClient({ connectionString: databaseUrl as string });
		try {
			const repository = new DrizzleVaultRepository(client.database);
			const vault = baseVault();
			const created = await repository.initializeVaultWithKeyEnvelopes(vault, [envelope(vault.id)]);

			expect(await repository.getVaultById(created.id)).toMatchObject({
				id: created.id,
				status: 'initialized',
			});
			expect(await repository.getVaultById(randomUUID())).toBeNull();

			// Durable lifecycle status only — runtime lock state is never persisted.
			await repository.updateVaultStatus(created.id, 'initialized', new Date().toISOString());
			expect(await repository.getVaultById(created.id)).toMatchObject({ status: 'initialized' });
		} finally {
			await client.close();
		}
	});

	it('reports readiness through the client ping', async () => {
		const client = createDatabaseClient({ connectionString: databaseUrl as string });
		try {
			await expect(client.ping()).resolves.toBeUndefined();
		} finally {
			await client.close();
		}
	});

	it('rejects vault initialization without envelopes', async () => {
		const client = createDatabaseClient({ connectionString: databaseUrl as string });
		try {
			const repository = new DrizzleVaultRepository(client.database);
			await expect(
				repository.initializeVaultWithKeyEnvelopes(baseVault(), []),
			).rejects.toBeInstanceOf(TypeError);
		} finally {
			await client.close();
		}
	});

	it('maps a unique envelope conflict to a stable error', async () => {
		const client = createDatabaseClient({ connectionString: databaseUrl as string });
		try {
			const repository = new DrizzleVaultRepository(client.database);
			const vaultId = randomUUID();
			const envelopeId = randomUUID();
			const secondVaultId = randomUUID();
			await repository.initializeVaultWithKeyEnvelopes(baseVaultWith(vaultId), [
				{ ...envelope(vaultId), id: envelopeId },
			]);

			await expect(
				repository.initializeVaultWithKeyEnvelopes(baseVaultWith(secondVaultId), [
					{ ...envelope(secondVaultId), id: envelopeId },
				]),
			).rejects.toBeInstanceOf(UniqueConstraintViolationError);
		} finally {
			await client.close();
		}
	});

	it('fails a duplicate vault id on the primary key (concurrent init safety)', async () => {
		const client = createDatabaseClient({ connectionString: databaseUrl as string });
		try {
			const repository = new DrizzleVaultRepository(client.database);
			const vaultId = randomUUID();
			await repository.initializeVaultWithKeyEnvelopes(baseVaultWith(vaultId), [envelope(vaultId)]);
			await expect(
				repository.initializeVaultWithKeyEnvelopes(baseVaultWith(vaultId), [envelope(vaultId)]),
			).rejects.toBeInstanceOf(UniqueConstraintViolationError);
		} finally {
			await client.close();
		}
	});

	it('selects only the eligible, non-revoked envelope for a purpose', async () => {
		const client = createDatabaseClient({ connectionString: databaseUrl as string });
		try {
			const repository = new DrizzleVaultRepository(client.database);
			const vaultId = randomUUID();
			const now = new Date().toISOString();
			await repository.initializeVaultWithKeyEnvelopes(baseVaultWith(vaultId), [
				{ ...envelope(vaultId, VAULT_PURPOSE), revokedAt: now },
				envelope(vaultId, VAULT_PURPOSE),
				envelope(vaultId, 'recovery'),
			]);

			const active = await repository.getActiveKeyEnvelope(vaultId, VAULT_PURPOSE);
			expect(active).not.toBeNull();
			expect(active?.purpose).toBe(VAULT_PURPOSE);
			expect(active?.revokedAt).toBeNull();
			await expect(repository.getActiveKeyEnvelope(vaultId, 'missing')).resolves.toBeNull();
		} finally {
			await client.close();
		}
	});

	it('supports encrypted record CRUD, vault scoping, and not-found handling', async () => {
		const client = createDatabaseClient({ connectionString: databaseUrl as string });
		try {
			const vaultRepository = new DrizzleVaultRepository(client.database);
			const recordRepository = new DrizzleVaultRecordRepository(client.database);
			const now = new Date().toISOString();
			const vaultId = randomUUID();
			const otherVaultId = randomUUID();
			await vaultRepository.initializeVaultWithKeyEnvelopes(baseVaultWith(vaultId), [
				envelope(vaultId),
			]);
			await vaultRepository.initializeVaultWithKeyEnvelopes(baseVaultWith(otherVaultId), [
				envelope(otherVaultId),
			]);

			const record = await recordRepository.createRecord({
				id: randomUUID(),
				vaultId,
				recordType: 'encrypted_payload',
				encryptionVersion: 1,
				nonce: Buffer.from('nonce'),
				ciphertext: Buffer.from('ciphertext'),
				createdAt: now,
				updatedAt: now,
				deletedAt: null,
			});

			expect(await recordRepository.getRecordById(vaultId, record.id)).toMatchObject({
				id: record.id,
				vaultId,
				recordType: 'encrypted_payload',
			});
			// Scoped by vault id: another vault cannot read this record.
			await expect(recordRepository.getRecordById(otherVaultId, record.id)).resolves.toBeNull();
			await expect(recordRepository.getRecordById(vaultId, randomUUID())).resolves.toBeNull();

			// Timestamps round-trip as canonical, millisecond-precision ISO UTC.
			const read = await recordRepository.getRecordById(vaultId, record.id);
			expect(read?.createdAt).toBe(now);
			expect(read?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
		} finally {
			await client.close();
		}
	});

	it('lists records for a vault with deterministic keyset pagination', async () => {
		const client = createDatabaseClient({ connectionString: databaseUrl as string });
		try {
			const vaultRepository = new DrizzleVaultRepository(client.database);
			const recordRepository = new DrizzleVaultRecordRepository(client.database);
			const vaultId = randomUUID();
			const otherVaultId = randomUUID();
			await vaultRepository.initializeVaultWithKeyEnvelopes(baseVaultWith(vaultId), [
				envelope(vaultId),
			]);
			await vaultRepository.initializeVaultWithKeyEnvelopes(baseVaultWith(otherVaultId), [
				envelope(otherVaultId),
			]);

			const base = Date.parse('2026-01-01T00:00:00.000Z');
			const ids: string[] = [];
			for (let i = 0; i < 3; i += 1) {
				const created = new Date(base + i * 1000).toISOString();
				const rec = await recordRepository.createRecord({
					id: randomUUID(),
					vaultId,
					recordType: 'encrypted_payload',
					encryptionVersion: 1,
					nonce: Buffer.from([i]),
					ciphertext: Buffer.from([i]),
					createdAt: created,
					updatedAt: created,
					deletedAt: null,
				});
				ids.push(rec.id);
			}
			await recordRepository.createRecord({
				id: randomUUID(),
				vaultId: otherVaultId,
				recordType: 'encrypted_payload',
				encryptionVersion: 1,
				nonce: Buffer.from('x'),
				ciphertext: Buffer.from('x'),
				createdAt: new Date(base).toISOString(),
				updatedAt: new Date(base).toISOString(),
				deletedAt: null,
			});

			const page1 = await recordRepository.listRecordsByVault(vaultId, { limit: 2 });
			expect(page1.map((r) => r.id)).toEqual([ids[0], ids[1]]);

			const last = page1[1];
			const page2 = await recordRepository.listRecordsByVault(vaultId, {
				limit: 2,
				after: { createdAt: last?.createdAt as string, id: last?.id as string },
			});
			expect(page2.map((r) => r.id)).toEqual([ids[2]]);
		} finally {
			await client.close();
		}
	});

	it('physically deletes a vault-scoped record', async () => {
		const client = createDatabaseClient({ connectionString: databaseUrl as string });
		try {
			const vaultRepository = new DrizzleVaultRepository(client.database);
			const recordRepository = new DrizzleVaultRecordRepository(client.database);
			const now = new Date().toISOString();
			const vaultId = randomUUID();
			await vaultRepository.initializeVaultWithKeyEnvelopes(baseVaultWith(vaultId), [
				envelope(vaultId),
			]);
			const record = await recordRepository.createRecord({
				id: randomUUID(),
				vaultId,
				recordType: 'encrypted_payload',
				encryptionVersion: 1,
				nonce: Buffer.from('n'),
				ciphertext: Buffer.from('c'),
				createdAt: now,
				updatedAt: now,
				deletedAt: null,
			});

			expect(await recordRepository.deleteRecord(vaultId, record.id)).toBe(true);
			await expect(recordRepository.getRecordById(vaultId, record.id)).resolves.toBeNull();
			expect(await recordRepository.deleteRecord(vaultId, record.id)).toBe(false);
		} finally {
			await client.close();
		}
	});
});

describe.skipIf(!databaseUrl)('PostgreSQL transaction rollback', () => {
	it('rolls back a vault insert when an operation fails after the insert', async () => {
		const client = createDatabaseClient({ connectionString: databaseUrl as string });
		try {
			const vault = baseVault();
			await expect(
				withDatabaseTransaction(client.database, async (transaction) => {
					await transaction.insert(vaults).values(vault).returning();
					throw new Error('forced transaction failure');
				}),
			).rejects.toThrow('forced transaction failure');

			const rows = await client.database.select().from(vaults).where(eq(vaults.id, vault.id));
			expect(rows).toHaveLength(0);
		} finally {
			await client.close();
		}
	});
});

function baseVaultWith(id: string) {
	return { ...baseVault(), id };
}
