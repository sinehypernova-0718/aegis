import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { unlockVaultSession } from '@aegis/crypto';
import { createDatabaseClient, vaultKeyEnvelopes, vaultRecords } from '@aegis/database';
import {
	CredentialDecryptionError,
	CredentialNotFoundError,
	InvalidCredentialPayloadError,
	UnlockRejectedError,
	UnsupportedEncryptionFormatError,
	VaultLockedError,
} from '@aegis/domain';

import {
	PRIMARY_KEY_ENVELOPE_PURPOSE,
	createAegisContainer,
} from './composition/aegis-container.js';
import { systemClock, uuidGenerator } from './composition/runtime.js';

const databaseUrl = process.env.DATABASE_URL;

const MARKERS = [
	'TEST_NAME_MARKER_a1b2',
	'TEST_SECRET_MARKER_7c91',
	'TEST_USER_MARKER_e5f6',
	'TEST_URL_MARKER_c3d4',
	'TEST_PRIVATE_NOTE_MARKER_4d28',
	'TEST_TAG_MARKER_8b35',
];

describe.skipIf(!databaseUrl)('vault vertical slice (real crypto + domain + PostgreSQL)', () => {
	it('runs the full lifecycle with encrypted-at-rest payloads', async () => {
		const client = createDatabaseClient({ connectionString: databaseUrl as string });
		const passphrase = 'correct horse battery staple';
		try {
			const container = createAegisContainer({
				database: client.database,
				clock: systemClock,
				ids: uuidGenerator,
			});

			// 1. Initialize a new vault.
			const initialized = await container.initializeVault.execute({ passphrase });
			expect(initialized.runtimeState).toBe('unlocked');
			const { vaultId } = initialized;

			// 2. Create a credential with distinctive markers in every sensitive field.
			const created = await container.createCredential.execute({
				vaultId,
				payload: {
					type: 'password',
					name: MARKERS[0] as string,
					secret: MARKERS[1] as string,
					username: MARKERS[2] as string,
					url: `https://${MARKERS[3]}.example`,
					notes: MARKERS[4] as string,
					tags: [MARKERS[5] as string],
					expiresAt: '2030-01-01T00:00:00.000Z',
				},
			});

			// 3. Inspect the raw database row: no plaintext markers, ciphertext present.
			const [row] = await client.database
				.select()
				.from(vaultRecords)
				.where(eq(vaultRecords.id, created.id));
			expect(row?.recordType).toBe('encrypted_payload');
			expect(row?.nonce.length).toBeGreaterThan(0);
			expect(row?.ciphertext.length).toBeGreaterThan(0);
			const persisted = JSON.stringify({
				...row,
				nonce: Buffer.from(row?.nonce as Buffer).toString('hex'),
				ciphertext: Buffer.from(row?.ciphertext as Buffer).toString('hex'),
			});
			for (const marker of MARKERS) {
				expect(persisted, `marker leaked: ${marker}`).not.toContain(marker);
			}
			expect(JSON.stringify(row)).not.toContain('password');

			// 4. Retrieve and verify round-trip.
			const fetched = await container.getCredential.execute({ vaultId, id: created.id });
			expect(fetched.payload.secret).toBe(MARKERS[1]);
			expect(fetched.payload.name).toBe(MARKERS[0]);
			expect(fetched.payload.notes).toBe(MARKERS[4]);
			expect(fetched.payload.tags).toEqual([MARKERS[5]]);

			// 5. Pagination.
			await container.createCredential.execute({
				vaultId,
				payload: { type: 'api_key', name: 'second', secret: 's2' },
			});
			await container.createCredential.execute({
				vaultId,
				payload: { type: 'access_token', name: 'third', secret: 's3' },
			});
			const page1 = await container.listCredentials.execute({ vaultId, limit: 2 });
			expect(page1.items).toHaveLength(2);
			expect(page1.nextCursor).not.toBeNull();
			const page2 = await container.listCredentials.execute({
				vaultId,
				cursor: page1.nextCursor,
			});
			expect(page2.items).toHaveLength(1);
			expect(page2.nextCursor).toBeNull();

			// 6. Update persists new values with a fresh nonce.
			const beforeNonce = Buffer.from(row?.nonce as Buffer).toString('hex');
			const updated = await container.updateCredential.execute({
				vaultId,
				id: created.id,
				payload: {
					type: 'password',
					name: MARKERS[0] as string,
					secret: 'UPDATED_SECRET_MARKER_9z9z',
				},
			});
			expect(updated.payload.secret).toBe('UPDATED_SECRET_MARKER_9z9z');
			const [afterUpdate] = await client.database
				.select()
				.from(vaultRecords)
				.where(eq(vaultRecords.id, created.id));
			expect(Buffer.from(afterUpdate?.nonce as Buffer).toString('hex')).not.toBe(beforeNonce);

			// 7. Cross-vault access is rejected.
			const other = await container.initializeVault.execute({ passphrase: 'another passphrase' });
			await expect(
				container.getCredential.execute({ vaultId: other.vaultId, id: created.id }),
			).rejects.toBeInstanceOf(CredentialNotFoundError);

			// 8. Lock the vault: credential operations fail.
			await container.lockVault.execute({ vaultId });
			await expect(
				container.getCredential.execute({ vaultId, id: created.id }),
			).rejects.toBeInstanceOf(VaultLockedError);

			// 9. Unlock again from the persisted envelope.
			await expect(container.unlockVault.execute({ vaultId, passphrase })).resolves.toEqual({
				vaultId,
				status: 'unlocked',
			});

			// 10. Retrieve the updated credential.
			const afterUnlock = await container.getCredential.execute({ vaultId, id: created.id });
			expect(afterUnlock.payload.secret).toBe('UPDATED_SECRET_MARKER_9z9z');

			// 13. Security failures do not expose secrets or create sessions.
			{
				const now = new Date().toISOString();
				const tamperId = randomUUID();
				const [source] = await client.database
					.select()
					.from(vaultRecords)
					.where(eq(vaultRecords.id, created.id));
				const tampered = Buffer.from(source?.ciphertext as Buffer);
				tampered[0] = (tampered[0] as number) ^ 0x01;
				await client.database.insert(vaultRecords).values({
					id: tamperId,
					vaultId,
					recordType: 'encrypted_payload',
					encryptionVersion: 1,
					nonce: Buffer.from(source?.nonce as Buffer),
					ciphertext: tampered,
					createdAt: now,
					updatedAt: now,
					deletedAt: null,
				});
				await expect(
					container.getCredential.execute({ vaultId, id: tamperId }),
				).rejects.toBeInstanceOf(CredentialDecryptionError);

				const versionId = randomUUID();
				await client.database.insert(vaultRecords).values({
					id: versionId,
					vaultId,
					recordType: 'encrypted_payload',
					encryptionVersion: 2,
					nonce: Buffer.from(source?.nonce as Buffer),
					ciphertext: Buffer.from(source?.ciphertext as Buffer),
					createdAt: now,
					updatedAt: now,
					deletedAt: null,
				});
				await expect(
					container.getCredential.execute({ vaultId, id: versionId }),
				).rejects.toBeInstanceOf(UnsupportedEncryptionFormatError);

				// Malformed decrypted payload (valid AEAD, invalid JSON).
				const [envelopeRow] = await client.database
					.select()
					.from(vaultKeyEnvelopes)
					.where(
						and(
							eq(vaultKeyEnvelopes.vaultId, vaultId),
							eq(vaultKeyEnvelopes.purpose, PRIMARY_KEY_ENVELOPE_PURPOSE),
						),
					);
				const session = await unlockVaultSession({
					vaultId,
					passphrase,
					envelope: envelopeRow?.envelope,
				});
				const bogusId = randomUUID();
				const encrypted = session.encryptRecord({
					recordId: bogusId,
					plaintext: new TextEncoder().encode('{not valid json'),
				});
				await client.database.insert(vaultRecords).values({
					id: bogusId,
					vaultId,
					recordType: 'encrypted_payload',
					encryptionVersion: encrypted.encryptionVersion,
					nonce: Buffer.from(encrypted.nonce),
					ciphertext: Buffer.from(encrypted.ciphertext),
					createdAt: now,
					updatedAt: now,
					deletedAt: null,
				});
				session.dispose();
				await expect(
					container.getCredential.execute({ vaultId, id: bogusId }),
				).rejects.toBeInstanceOf(InvalidCredentialPayloadError);

				// Wrong passphrase after locking.
				await container.lockVault.execute({ vaultId });
				await expect(
					container.unlockVault.execute({ vaultId, passphrase: 'wrong passphrase' }),
				).rejects.toBeInstanceOf(UnlockRejectedError);
				await container.unlockVault.execute({ vaultId, passphrase });
			}

			// 11. Delete and confirm the row is gone.
			await expect(
				container.deleteCredential.execute({ vaultId, id: created.id }),
			).resolves.toEqual({ id: created.id, deleted: true });
			const afterDelete = await client.database
				.select()
				.from(vaultRecords)
				.where(eq(vaultRecords.id, created.id));
			expect(afterDelete).toHaveLength(0);

			// 12. Simulated restart: a fresh session manager starts locked.
			const restarted = createAegisContainer({
				database: client.database,
				clock: systemClock,
				ids: uuidGenerator,
			});
			await expect(restarted.getVaultStatus.execute({ vaultId })).resolves.toEqual({
				status: 'locked',
				vaultId,
			});
		} finally {
			await client.close();
		}
	});
});
