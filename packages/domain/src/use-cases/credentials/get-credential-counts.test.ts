import { describe, expect, it, vi } from 'vitest';

import type { CredentialKind } from '../../credentials/credential-kind.js';
import type { CredentialView } from './credential-view.js';
import { GetCredentialCounts } from './get-credential-counts.js';
import type { ListCredentials } from './list-credentials.js';

describe('GetCredentialCounts', () => {
	it('counts every page without retaining a vault-wide result', async () => {
		const kinds: CredentialKind[] = [
			'password',
			'api_key',
			'access_token',
			'refresh_token',
			'ssh_key',
			'oauth2',
			'secure_note',
			'certificate',
			'recovery_code',
		];
		const items: CredentialView[] = Array.from({ length: 205 }, (_, index) => ({
			id: `credential-${index}`,
			createdAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-01-01T00:00:00.000Z',
			payload: {
				schemaVersion: 1,
				type: kinds[index % kinds.length]!,
				name: `Credential ${index}`,
				secret: 'secret',
				tags: [],
			},
		}));
		const execute = vi.fn(
			async ({ cursor }: { vaultId: string; limit?: number; cursor?: string }) => {
				const offset = Number(cursor ?? 0);
				const page = items.slice(offset, offset + 100);
				return {
					items: page,
					nextCursor: offset + page.length < items.length ? String(offset + page.length) : null,
				};
			},
		);
		const listCredentials = { execute } as unknown as ListCredentials;

		const counts = await new GetCredentialCounts({ listCredentials }).execute({
			vaultId: 'vault-1',
		});

		expect(execute).toHaveBeenCalledTimes(3);
		expect(counts).toEqual({
			credentialCount: 205,
			passwordCount: 23,
			apiKeyCount: 69,
			tokenCount: 46,
			sshKeyCount: 23,
			oauth2Count: 23,
			secureNoteCount: 67,
		});
	});
});
