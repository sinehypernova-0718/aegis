/**
 * Selection-scope regression test (design spec §1.1 / §6 / D2).
 *
 * Reproduces the reported defect: selecting an SSH key and then navigating to
 * Secure Notes used to leave the SSH key rendered in the detail workspace.
 * store.navigate() must now clear the active selection so a page can never
 * present a credential of a different kind.
 */

import assert from 'node:assert/strict';
import { setActivePinia, createPinia } from 'pinia';
import { useVaultStore, setVaultClient } from '../src/stores/vaultStore';
import type { VaultClient } from '../src/services/api/contracts';
import type {
	CreateCredentialInput,
	CredentialDetail,
	CredentialSummary,
	UpdateCredentialInput,
	VaultStatus,
} from '../src/types';

const sshSummary: CredentialSummary = {
	id: 'ssh-1',
	vaultId: 'vault-test',
	kind: 'ssh-key',
	title: 'Kubernetes Cluster Node',
	category: 'Operations',
	tags: ['k8s', 'ssh'],
	createdAt: '2026-10-01T00:00:00Z',
	updatedAt: '2026-10-02T00:00:00Z',
};

const sshDetail: CredentialDetail = {
	...sshSummary,
	secret: '-----BEGIN OPENSSH PRIVATE KEY-----',
	sshKeyMetadata: {
		keyType: 'rsa',
		fingerprint: 'SHA256:test',
		passphraseProtected: false,
		publicKey: 'ssh-rsa AAAAB3NzaC1yc2E-test',
	},
};

const client: VaultClient = {
	async getVaultStatus(): Promise<VaultStatus> {
		return { state: 'unlocked', vaultId: 'vault-test', credentialCount: 1 };
	},
	async unlockVault() {
		return { success: true };
	},
	async createVault() {
		return { success: true };
	},
	async lockVault() {
		/* no-op for this test */
	},
	async listCredentials(): Promise<CredentialSummary[]> {
		return [sshSummary];
	},
	async listPasswords(): Promise<CredentialSummary[]> {
		return [];
	},
	async listApiKeys(): Promise<CredentialSummary[]> {
		return [];
	},
	async getCredential(id: string): Promise<CredentialDetail> {
		return { ...sshDetail, id };
	},
	async createCredential(input: CreateCredentialInput): Promise<CredentialSummary> {
		return { ...sshSummary, id: 'new-credential', kind: input.kind, title: input.title };
	},
	async updateCredential(_id: string, input: UpdateCredentialInput): Promise<CredentialSummary> {
		return { ...sshSummary, title: input.title ?? sshSummary.title };
	},
	async deleteCredential() {
		/* no-op for this test */
	},
	async getActivity() {
		return [];
	},
	isUnlocked(): boolean {
		return true;
	},
};

async function run(): Promise<void> {
	console.log('--- Selection scope regression test ---');

	setActivePinia(createPinia());
	setVaultClient(client);

	const store = useVaultStore();
	await store.init();
	assert.equal(store.isUnlocked, true, 'Vault must initialise as unlocked');

	await store.selectCredential('ssh-1');
	assert.equal(store.selectedCredential?.id, 'ssh-1', 'SSH key selection must load');
	assert.equal(store.selectedCredential?.kind, 'ssh-key');

	// The reported defect: switching sections must not leave the SSH key visible.
	store.navigate('secure-notes');
	assert.equal(
		store.selectedCredential,
		null,
		'navigate() must clear selectedCredential so the detail pane cannot show an out-of-scope item',
	);
	assert.equal(store.currentPage, 'secure-notes', 'Navigation must still update the current page');

	console.log('Selection scope regression test passed cleanly!\n');
}

run().catch((error) => {
	console.error('Selection scope regression test failed:', error);
	process.exit(1);
});