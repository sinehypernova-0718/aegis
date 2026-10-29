import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';

import { createDatabaseClient, vaultRecords } from '@aegis/database';

import { UnlockThrottle } from './auth.js';
import { buildServer } from './build-server.js';
import { createAegisContainer } from '../composition/aegis-container.js';
import { systemClock, uuidGenerator } from '../composition/runtime.js';
import {
	TEST_API_TOKEN,
	TEST_CORRECT_PASSPHRASE,
	TEST_NOTE_MARKER,
	TEST_SECRET_MARKER,
	TEST_WRONG_PASSPHRASE,
} from '../testing/fakes.js';

const databaseUrl = process.env.DATABASE_URL;

interface TestRequest {
	readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE';
	readonly url: string;
	readonly payload?: string | object;
	readonly headers?: Record<string, string>;
}

function inject(app: FastifyInstance, request: TestRequest) {
	return app.inject({
		method: request.method,
		url: request.url,
		...(request.payload !== undefined ? { payload: request.payload } : {}),
		headers: {
			host: '127.0.0.1:7787',
			authorization: `Bearer ${TEST_API_TOKEN}`,
			...request.headers,
		},
	});
}

describe.skipIf(!databaseUrl)('HTTP boundary (real composition root + PostgreSQL)', () => {
	it('runs the full vault and credential lifecycle over HTTP', async () => {
		const client = createDatabaseClient({ connectionString: databaseUrl as string });
		const container = createAegisContainer({
			database: client.database,
			clock: systemClock,
			ids: uuidGenerator,
		});
		const app = buildServer({
			container,
			apiToken: TEST_API_TOKEN,
			port: 7_787,
			bodyLimitBytes: 262_144,
			logLevel: 'silent',
			logger: false,
			checkReadiness: () => client.ping(),
			unlockThrottle: new UnlockThrottle({
				maxFailures: 100,
				windowMs: 60_000,
				lockoutMs: 60_000,
			}),
		});

		try {
			const ready = await inject(app, { method: 'GET', url: '/readyz' });
			expect(ready.statusCode).toBe(200);

			const initialized = await inject(app, {
				method: 'POST',
				url: '/vaults',
				payload: { passphrase: TEST_CORRECT_PASSPHRASE },
			});
			expect(initialized.statusCode).toBe(201);
			const { vaultId } = initialized.json() as { vaultId: string };

			const created = await inject(app, {
				method: 'POST',
				url: `/vaults/${vaultId}/credentials`,
				payload: {
					payload: {
						type: 'password',
						name: 'HTTP integration',
						secret: TEST_SECRET_MARKER,
						notes: TEST_NOTE_MARKER,
						tags: ['integration'],
					},
				},
			});
			expect(created.statusCode).toBe(201);
			expect(created.body).not.toContain(TEST_SECRET_MARKER);
			expect(created.body).not.toContain(TEST_NOTE_MARKER);
			const credentialId = (created.json() as { id: string }).id;

			const [row] = await client.database
				.select()
				.from(vaultRecords)
				.where(eq(vaultRecords.id, credentialId));
			expect(row?.recordType).toBe('encrypted_payload');
			const persisted = JSON.stringify({
				...row,
				nonce: Buffer.from(row?.nonce as Buffer).toString('hex'),
				ciphertext: Buffer.from(row?.ciphertext as Buffer).toString('hex'),
			});
			expect(persisted).not.toContain(TEST_SECRET_MARKER);
			expect(persisted).not.toContain(TEST_NOTE_MARKER);

			const list = await inject(app, {
				method: 'GET',
				url: `/vaults/${vaultId}/credentials`,
			});
			expect(list.statusCode).toBe(200);
			expect(list.body).not.toContain(TEST_SECRET_MARKER);
			expect((list.json() as { items: unknown[] }).items).toHaveLength(1);

			const detail = await inject(app, {
				method: 'GET',
				url: `/vaults/${vaultId}/credentials/${credentialId}`,
			});
			expect(detail.statusCode).toBe(200);
			expect(detail.json()).toMatchObject({
				payload: { secret: TEST_SECRET_MARKER, notes: TEST_NOTE_MARKER },
			});

			const updated = await inject(app, {
				method: 'PUT',
				url: `/vaults/${vaultId}/credentials/${credentialId}`,
				payload: {
					payload: {
						type: 'password',
						name: 'HTTP integration',
						secret: 'UPDATED_HTTP_MARKER_9z9z',
					},
				},
			});
			expect(updated.statusCode).toBe(200);
			expect(updated.body).not.toContain('UPDATED_HTTP_MARKER_9z9z');

			await inject(app, {
				method: 'POST',
				url: `/vaults/${vaultId}/lock`,
			});
			const locked = await inject(app, {
				method: 'GET',
				url: `/vaults/${vaultId}/credentials/${credentialId}`,
			});
			expect(locked.statusCode).toBe(423);
			expect(locked.json()).toMatchObject({ code: 'VAULT_LOCKED' });

			const wrong = await inject(app, {
				method: 'POST',
				url: `/vaults/${vaultId}/unlock`,
				payload: { passphrase: TEST_WRONG_PASSPHRASE },
			});
			expect(wrong.statusCode).toBe(401);

			const unlocked = await inject(app, {
				method: 'POST',
				url: `/vaults/${vaultId}/unlock`,
				payload: { passphrase: TEST_CORRECT_PASSPHRASE },
			});
			expect(unlocked.statusCode).toBe(200);

			const afterUnlock = await inject(app, {
				method: 'GET',
				url: `/vaults/${vaultId}/credentials/${credentialId}`,
			});
			expect(afterUnlock.statusCode).toBe(200);
			expect(afterUnlock.json()).toMatchObject({
				payload: { secret: 'UPDATED_HTTP_MARKER_9z9z' },
			});

			const deleted = await inject(app, {
				method: 'DELETE',
				url: `/vaults/${vaultId}/credentials/${credentialId}`,
			});
			expect(deleted.statusCode).toBe(200);
			expect(deleted.json()).toEqual({ id: credentialId, deleted: true });

			const missing = await inject(app, {
				method: 'GET',
				url: `/vaults/${vaultId}/credentials/${credentialId}`,
			});
			expect(missing.statusCode).toBe(404);
		} finally {
			await container.sessionManager.lockAll().catch(() => {});
			await app.close().catch(() => {});
			await client.close().catch(() => {});
		}
	}, 60_000);
});
