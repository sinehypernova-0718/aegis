import { describe, expect, it, vi } from 'vitest';

import { ENCRYPTED_RECORD_TYPE, type CredentialKind } from '../../credentials/credential-kind.js';
import { DefaultVaultSessionManager } from '../../sessions/vault-session-manager.js';
import { FakeVaultSession, InMemoryCredentialRepository } from '../../testing/fakes.js';
import { GetCredentialCounts } from './get-credential-counts.js';
import { ListCredentials } from './list-credentials.js';

describe('GetCredentialCounts', () => {
	it('counts all 205 encrypted credentials through the real bounded list use case', async () => {
		const vaultId = '00000000-0000-4000-8000-000000000001';
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
		const credentialRepository = new InMemoryCredentialRepository();
		const plaintextById = new Map<string, Uint8Array>();
		const createdAt = '2026-01-01T00:00:00.000Z';
		for (let index = 0; index < 205; index += 1) {
			const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
			const type = kinds[index % kinds.length]!;
			const payload = {
				schemaVersion: 1,
				type,
				name: `Credential ${index}`,
				secret: 'secret',
				tags: [],
				...(type === 'oauth2' ? { oauth2Metadata: {} } : {}),
			};
			const plaintext = new TextEncoder().encode(JSON.stringify(payload));
			plaintextById.set(id, plaintext);
			credentialRepository.records.set(id, {
				id,
				vaultId,
				recordType: ENCRYPTED_RECORD_TYPE,
				encryptionVersion: 1,
				nonce: new Uint8Array(24),
				ciphertext: plaintext,
				createdAt,
				updatedAt: createdAt,
				deletedAt: null,
			});
		}
		const listRecords = vi.spyOn(credentialRepository, 'listRecordsByVault');
		const sessionManager = new DefaultVaultSessionManager({ idleTimeoutMs: 0 });
		sessionManager.register(vaultId, new FakeVaultSession(vaultId, plaintextById, []));
		const listCredentials = new ListCredentials({ credentialRepository, sessionManager });

		const counts = await new GetCredentialCounts({ listCredentials }).execute({
			vaultId,
		});

		expect(listRecords).toHaveBeenCalledTimes(3);
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
