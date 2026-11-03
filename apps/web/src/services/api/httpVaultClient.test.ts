import { describe, expect, it } from 'vitest';

import { SessionClient } from '@/auth/session';
import { HttpVaultClient } from './httpVaultClient';

const credentialId = '33333333-3333-4333-8333-333333333333';
const vaultId = '11111111-1111-4111-8111-111111111111';
const timestamp = '2026-01-01T00:00:00.000Z';

describe('HttpVaultClient credential kind preservation', () => {
	it.each(['refresh_token', 'certificate', 'recovery_code'] as const)(
		'preserves %s when updating a credential',
		async (kind) => {
			let updatedPayload: { payload: { type: string } } | undefined;
			const session = new SessionClient({
				fetch: async (input, init) => {
					const url = new URL(String(input), 'http://localhost');
					if (url.pathname === '/auth/session' && init?.method === 'GET') {
						return new Response(null, { status: 204 });
					}
					if (url.pathname.endsWith(`/credentials/${credentialId}`) && init?.method === 'GET') {
						return Response.json({
							id: credentialId,
							createdAt: timestamp,
							updatedAt: timestamp,
							payload: {
								schemaVersion: 1,
								type: kind,
								name: 'Original name',
								secret: 'secret',
								tags: [],
							},
						});
					}
					if (url.pathname.endsWith(`/credentials/${credentialId}`) && init?.method === 'PUT') {
						updatedPayload = JSON.parse(String(init.body)) as { payload: { type: string } };
						return Response.json({ id: credentialId, updatedAt: timestamp });
					}
					throw new Error(`Unexpected request: ${init?.method} ${url.pathname}`);
				},
			});
			const client = new HttpVaultClient({ session, vaultId });

			await client.updateCredential(credentialId, { title: 'Updated name' });

			expect(updatedPayload?.payload.type).toBe(kind);
		},
	);
});
