import { describe, expect, it } from 'vitest';

import { CreateCredential } from './create-credential.js';
import { DeleteCredential } from './delete-credential.js';
import { GetCredential } from './get-credential.js';
import { ListCredentials } from './list-credentials.js';
import { UpdateCredential } from './update-credential.js';
import { ENCRYPTED_RECORD_TYPE } from '../../credentials/credential-kind.js';
import {
	CredentialDecryptionError,
	CredentialNotFoundError,
	InvalidCredentialPayloadError,
	PersistenceError,
	VaultLockedError,
} from '../../errors/domain-errors.js';
import { InitializeVault } from '../vault/initialize-vault.js';
import { LockVault } from '../vault/lock-vault.js';
import { DefaultVaultSessionManager } from '../../sessions/vault-session-manager.js';
import {
	FakeScheduler,
	FakeVaultCryptoPort,
	FixedClock,
	InMemoryCredentialRepository,
	InMemoryVaultRepository,
	SequentialIdGenerator,
} from '../../testing/fakes.js';

const PURPOSE = 'primary';

const credential = {
	type: 'password' as const,
	name: 'GitHub',
	secret: 'TEST_SECRET_MARKER_7c91',
	notes: 'TEST_PRIVATE_NOTE_MARKER_4d28',
	tags: ['TEST_TAG_MARKER_8b35'],
};

async function setup() {
	const vaultRepository = new InMemoryVaultRepository();
	const sessionManager = new DefaultVaultSessionManager({ scheduler: new FakeScheduler() });
	const crypto = new FakeVaultCryptoPort();
	const clock = new FixedClock();
	const ids = new SequentialIdGenerator();
	const keyEnvelopePurpose = PURPOSE;
	const { vaultId } = await new InitializeVault({
		vaultRepository,
		sessionManager,
		crypto,
		clock,
		ids,
		keyEnvelopePurpose,
	}).execute({ passphrase: 'pw' });

	const credentialRepository = new InMemoryCredentialRepository();
	return {
		crypto,
		sessionManager,
		clock,
		ids,
		vaultId,
		vaultRepository,
		credentialRepository,
		create: new CreateCredential({ credentialRepository, sessionManager, clock, ids }),
		get: new GetCredential({ credentialRepository, sessionManager }),
		list: new ListCredentials({ credentialRepository, sessionManager }),
		update: new UpdateCredential({ credentialRepository, sessionManager, clock }),
		remove: new DeleteCredential({ credentialRepository, sessionManager }),
	};
}

describe('credential use cases', () => {
	it('creates and retrieves a credential', async () => {
		const s = await setup();
		const created = await s.create.execute({ vaultId: s.vaultId, payload: credential });
		expect(created.payload.name).toBe('GitHub');

		const row = s.credentialRepository.records.get(created.id);
		expect(row?.recordType).toBe(ENCRYPTED_RECORD_TYPE);
		expect(row?.nonce).toBeInstanceOf(Uint8Array);

		const fetched = await s.get.execute({ vaultId: s.vaultId, id: created.id });
		expect(fetched.payload).toEqual(created.payload);
	});

	it('lists with deterministic keyset pagination', async () => {
		const s = await setup();
		const ids: string[] = [];
		for (let i = 0; i < 3; i += 1) {
			const created = await s.create.execute({
				vaultId: s.vaultId,
				payload: { ...credential, name: `item-${i}` },
			});
			ids.push(created.id);
		}

		const page1 = await s.list.execute({ vaultId: s.vaultId, limit: 2 });
		expect(page1.items.map((item) => item.id)).toEqual([ids[0], ids[1]]);
		expect(page1.nextCursor).not.toBeNull();

		const page2 = await s.list.execute({ vaultId: s.vaultId, cursor: page1.nextCursor });
		expect(page2.items.map((item) => item.id)).toEqual([ids[2]]);
		expect(page2.nextCursor).toBeNull();
	});

	it('updates with a fresh nonce', async () => {
		const s = await setup();
		const created = await s.create.execute({ vaultId: s.vaultId, payload: credential });
		const noncesBefore = s.crypto.nonces.length;

		const updated = await s.update.execute({
			vaultId: s.vaultId,
			id: created.id,
			payload: { ...credential, secret: 'NEW_SECRET_MARKER_1234' },
		});
		expect(updated.payload.secret).toBe('NEW_SECRET_MARKER_1234');
		expect(s.crypto.nonces.length).toBeGreaterThan(noncesBefore);

		const fetched = await s.get.execute({ vaultId: s.vaultId, id: created.id });
		expect(fetched.payload.secret).toBe('NEW_SECRET_MARKER_1234');
	});

	it('physically deletes a credential', async () => {
		const s = await setup();
		const created = await s.create.execute({ vaultId: s.vaultId, payload: credential });
		await expect(s.remove.execute({ vaultId: s.vaultId, id: created.id })).resolves.toEqual({
			id: created.id,
			deleted: true,
		});
		expect(s.credentialRepository.records.has(created.id)).toBe(false);
		await expect(s.remove.execute({ vaultId: s.vaultId, id: created.id })).rejects.toBeInstanceOf(
			CredentialNotFoundError,
		);
	});

	it('rejects every credential operation when the vault is locked', async () => {
		const s = await setup();
		const lockedVault = s.vaultId;
		await new LockVault({ sessionManager: s.sessionManager }).execute({ vaultId: lockedVault });
		const id = '00000000-0000-4000-8000-0000000000ff';

		await expect(
			s.create.execute({ vaultId: lockedVault, payload: credential }),
		).rejects.toBeInstanceOf(VaultLockedError);
		await expect(s.get.execute({ vaultId: lockedVault, id })).rejects.toBeInstanceOf(
			VaultLockedError,
		);
		await expect(s.list.execute({ vaultId: lockedVault })).rejects.toBeInstanceOf(VaultLockedError);
		await expect(
			s.update.execute({ vaultId: lockedVault, id, payload: credential }),
		).rejects.toBeInstanceOf(VaultLockedError);
		await expect(s.remove.execute({ vaultId: lockedVault, id })).rejects.toBeInstanceOf(
			VaultLockedError,
		);
	});

	it('rejects cross-vault access', async () => {
		const s = await setup();
		const created = await s.create.execute({ vaultId: s.vaultId, payload: credential });

		const otherVaultId = '00000000-0000-4000-8000-0000000000aa';
		await new InitializeVault({
			vaultRepository: s.vaultRepository,
			sessionManager: s.sessionManager,
			crypto: s.crypto,
			clock: s.clock,
			ids: s.ids,
			keyEnvelopePurpose: PURPOSE,
		}).execute({ passphrase: 'pw', vaultId: otherVaultId });

		await expect(s.get.execute({ vaultId: otherVaultId, id: created.id })).rejects.toBeInstanceOf(
			CredentialNotFoundError,
		);
		await expect(
			s.update.execute({ vaultId: otherVaultId, id: created.id, payload: credential }),
		).rejects.toBeInstanceOf(CredentialNotFoundError);
		await expect(
			s.remove.execute({ vaultId: otherVaultId, id: created.id }),
		).rejects.toBeInstanceOf(CredentialNotFoundError);
	});

	it('rejects an invalid payload before persisting', async () => {
		const s = await setup();
		await expect(
			s.create.execute({ vaultId: s.vaultId, payload: { type: 'password', name: 'x' } as never }),
		).rejects.toBeInstanceOf(InvalidCredentialPayloadError);
		expect(s.credentialRepository.records.size).toBe(0);
	});

	it('reports persistence failures instead of success', async () => {
		const s = await setup();
		s.credentialRepository.failCreate = true;
		await expect(
			s.create.execute({ vaultId: s.vaultId, payload: credential }),
		).rejects.toBeInstanceOf(PersistenceError);

		s.credentialRepository.failCreate = false;
		const created = await s.create.execute({ vaultId: s.vaultId, payload: credential });
		s.credentialRepository.failUpdate = true;
		await expect(
			s.update.execute({ vaultId: s.vaultId, id: created.id, payload: credential }),
		).rejects.toBeInstanceOf(PersistenceError);
	});

	it('fails the whole page when a record cannot be decrypted', async () => {
		const s = await setup();
		const good = await s.create.execute({ vaultId: s.vaultId, payload: credential });

		const orphanId = '00000000-0000-4000-8000-0000000000ee';
		s.credentialRepository.records.set(orphanId, {
			id: orphanId,
			vaultId: s.vaultId,
			recordType: ENCRYPTED_RECORD_TYPE,
			encryptionVersion: 1,
			nonce: new Uint8Array(24),
			ciphertext: new Uint8Array(16),
			createdAt: '2026-01-02T00:00:00.000Z',
			updatedAt: '2026-01-02T00:00:00.000Z',
			deletedAt: null,
		});

		await expect(s.list.execute({ vaultId: s.vaultId })).rejects.toBeInstanceOf(
			CredentialDecryptionError,
		);
		await expect(s.get.execute({ vaultId: s.vaultId, id: orphanId })).rejects.toBeInstanceOf(
			CredentialDecryptionError,
		);
		// The healthy record still decrypts on its own.
		await expect(s.get.execute({ vaultId: s.vaultId, id: good.id })).resolves.toBeDefined();
	});
});
