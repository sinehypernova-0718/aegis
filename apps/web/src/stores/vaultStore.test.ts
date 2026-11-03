import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { VaultClient } from '@/services/api/contracts';
import { getVaultClient, setVaultClient, useVaultStore } from './vaultStore.js';

const originalClient = getVaultClient();

describe('vault store credential counts', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		setVaultClient(originalClient);
	});

	afterEach(() => setVaultClient(originalClient));

	it('uses aggregate counts for a vault larger than the loaded first page', async () => {
		const getCredentialCounts = vi.fn(async () => ({
			credentialCount: 205,
			passwordCount: 101,
			apiKeyCount: 52,
			tokenCount: 12,
			sshKeyCount: 20,
			oauth2Count: 10,
			secureNoteCount: 22,
		}));
		setVaultClient({
			listCredentialPage: async () => ({
				items: [
					{
						id: 'credential-1',
						vaultId: 'vault-1',
						kind: 'password',
						title: 'Credential 1',
						tags: [],
						createdAt: '2026-01-01T00:00:00.000Z',
						updatedAt: '2026-01-01T00:00:00.000Z',
					},
				],
				nextCursor: 'next-page',
			}),
			getCredentialCounts,
		} as unknown as VaultClient);

		const store = useVaultStore();
		await store.loadAll();

		expect(store.credentials).toHaveLength(1);
		expect(store.hasMoreCredentials).toBe(true);
		expect(getCredentialCounts).toHaveBeenCalledOnce();
		expect(store.status.credentialCount).toBe(205);
		expect(store.status.passwordCount).toBe(101);
		expect(store.status.apiKeyCount).toBe(52);
		expect(store.credentialCountsLoaded).toBe(true);
	});
});
