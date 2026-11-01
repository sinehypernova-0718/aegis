import assert from 'node:assert/strict';
import { CREDENTIAL_KINDS, CATEGORIES } from '../src/services/api/contracts';
import {
	SYNTHETIC_PASSWORDS,
	SYNTHETIC_API_KEYS,
	SYNTHETIC_SSH_KEYS,
	SYNTHETIC_OAUTH2,
	SYNTHETIC_SECURE_NOTES,
	SYNTHETIC_CREDENTIALS,
	ALL_SYNTHETIC_CREDENTIALS,
	SYNTHETIC_ACTIVITY,
} from '../src/services/mock/fixtures';
import {
	mockVaultClient,
	setMockVaultState,
	resetMockVaultClient,
} from '../src/services/mock/mockVaultClient';
import type {
	CredentialKind,
	OAuth2Metadata,
	SshKeyMetadata,
	SecureNoteMetadata,
	ApiKeyMetadata,
	CreateCredentialInput,
	UpdateCredentialInput,
} from '../src/types';

console.log('--- Starting Aegis Phase 4 PR 2: Credential Models & Mock Service Tests ---');

async function runTests() {
	// Test 1: Contract definitions & CredentialKind completeness
	console.log('Test 1: Contract definitions and supported credential kinds');
	const expectedKinds: CredentialKind[] = [
		'password',
		'api-key',
		'access-token',
		'ssh-key',
		'oauth2',
		'secure-note',
	];
	const registeredKinds = CREDENTIAL_KINDS.map((k) => k.value);
	for (const kind of expectedKinds) {
		assert.ok(
			registeredKinds.includes(kind),
			`CREDENTIAL_KINDS must register credential kind: ${kind}`,
		);
	}
	assert.equal(CREDENTIAL_KINDS.length, 6, 'Must register exactly 6 credential kinds');
	assert.ok(CATEGORIES.includes('Security'), 'CATEGORIES must include Security');
	assert.ok(CATEGORIES.includes('Development'), 'CATEGORIES must include Development');
	assert.ok(CATEGORIES.includes('Infrastructure'), 'CATEGORIES must include Infrastructure');

	// Test 2: Fixtures catalog coverage across all credential models
	console.log('Test 2: Synthetic fixtures catalog coverage and metadata integrity');
	assert.ok(SYNTHETIC_PASSWORDS.length >= 2, 'SYNTHETIC_PASSWORDS must contain test fixtures');
	assert.ok(SYNTHETIC_API_KEYS.length >= 3, 'SYNTHETIC_API_KEYS must contain test fixtures');
	assert.ok(SYNTHETIC_SSH_KEYS.length >= 2, 'SYNTHETIC_SSH_KEYS must contain test fixtures');
	assert.ok(SYNTHETIC_OAUTH2.length >= 2, 'SYNTHETIC_OAUTH2 must contain test fixtures');
	assert.ok(
		SYNTHETIC_SECURE_NOTES.length >= 2,
		'SYNTHETIC_SECURE_NOTES must contain test fixtures',
	);

	// Verify SSH Key metadata structure
	const sshFixture = SYNTHETIC_SSH_KEYS[0];
	assert.equal(sshFixture.kind, 'ssh-key');
	assert.ok(sshFixture.sshKeyMetadata?.keyType, 'SSH key fixture must specify keyType');
	assert.ok(sshFixture.sshKeyMetadata?.fingerprint, 'SSH key fixture must specify fingerprint');

	// Verify OAuth2 metadata structure
	const oauth2Fixture = SYNTHETIC_OAUTH2[0];
	assert.equal(oauth2Fixture.kind, 'oauth2');
	assert.ok(oauth2Fixture.oauth2Metadata?.clientId, 'OAuth2 fixture must specify clientId');
	assert.ok(oauth2Fixture.oauth2Metadata?.tokenUrl, 'OAuth2 fixture must specify tokenUrl');
	assert.ok(
		Array.isArray(oauth2Fixture.oauth2Metadata?.scopes),
		'OAuth2 fixture must specify scopes',
	);

	// Verify Secure Note metadata structure
	const noteFixture = SYNTHETIC_SECURE_NOTES[0];
	assert.equal(noteFixture.kind, 'secure-note');
	assert.ok(noteFixture.secureNoteMetadata?.format, 'Secure note fixture must specify format');
	assert.ok(
		noteFixture.notes && noteFixture.notes.length > 0,
		'Secure note fixture must have notes content',
	);

	// Verify unified fixture counts
	assert.equal(
		SYNTHETIC_CREDENTIALS.length,
		SYNTHETIC_PASSWORDS.length +
			SYNTHETIC_SSH_KEYS.length +
			SYNTHETIC_OAUTH2.length +
			SYNTHETIC_SECURE_NOTES.length,
		'SYNTHETIC_CREDENTIALS must combine passwords, ssh keys, oauth2, and secure notes',
	);
	assert.equal(
		ALL_SYNTHETIC_CREDENTIALS.length,
		SYNTHETIC_CREDENTIALS.length + SYNTHETIC_API_KEYS.length,
		'ALL_SYNTHETIC_CREDENTIALS must contain all fixtures',
	);

	// Test 3: Locked vault access gate enforcement
	console.log('Test 3: Authentication gate enforcement when vault is locked');
	resetMockVaultClient();
	setMockVaultState('locked');

	await assert.rejects(
		async () => await mockVaultClient.listCredentials(),
		/Vault is locked/,
		'listCredentials must throw when locked',
	);
	await assert.rejects(
		async () => await mockVaultClient.listPasswords(),
		/Vault is locked/,
		'listPasswords must throw when locked',
	);
	await assert.rejects(
		async () => await mockVaultClient.listApiKeys(),
		/Vault is locked/,
		'listApiKeys must throw when locked',
	);
	if (mockVaultClient.listOAuth2Credentials) {
		await assert.rejects(
			async () => await mockVaultClient.listOAuth2Credentials!(),
			/Vault is locked/,
			'listOAuth2Credentials must throw when locked',
		);
	}
	if (mockVaultClient.listSecureNotes) {
		await assert.rejects(
			async () => await mockVaultClient.listSecureNotes!(),
			/Vault is locked/,
			'listSecureNotes must throw when locked',
		);
	}
	await assert.rejects(
		async () => await mockVaultClient.getCredential('cred-001'),
		/Vault is locked/,
		'getCredential must throw when locked',
	);

	// Test 4: Unlocking and status breakdown metrics
	console.log('Test 4: Vault status metrics and type-specific breakdown');
	const unlockRes = await mockVaultClient.unlockVault('master-passphrase-valid');
	assert.ok(unlockRes.success, 'Unlocking with valid passphrase must succeed');
	assert.ok(mockVaultClient.isUnlocked(), 'Client must report unlocked state');

	const status = await mockVaultClient.getVaultStatus();
	assert.equal(status.state, 'unlocked');
	assert.equal(status.credentialCount, ALL_SYNTHETIC_CREDENTIALS.length);
	assert.equal(status.passwordCount, SYNTHETIC_PASSWORDS.length);
	assert.equal(status.apiKeyCount, SYNTHETIC_API_KEYS.length);
	assert.equal(status.sshKeyCount, SYNTHETIC_SSH_KEYS.length);
	assert.equal(status.oauth2Count, SYNTHETIC_OAUTH2.length);
	assert.equal(status.secureNoteCount, SYNTHETIC_SECURE_NOTES.length);

	// Test 5: Summary lists hygiene (no secrets in summaries)
	console.log('Test 5: Secret hygiene on summary listing');
	const summaries = await mockVaultClient.listCredentials();
	assert.equal(summaries.length, ALL_SYNTHETIC_CREDENTIALS.length);
	for (const s of summaries) {
		assert.strictEqual((s as any).secret, undefined, 'Summary must not leak secret');
		assert.strictEqual((s as any).notes, undefined, 'Summary must not leak notes');
	}

	// Filter by kind
	const sshSummaries = await mockVaultClient.listCredentials({ kind: 'ssh-key' });
	assert.equal(sshSummaries.length, SYNTHETIC_SSH_KEYS.length);
	for (const s of sshSummaries) {
		assert.equal(s.kind, 'ssh-key');
	}

	// Specialized convenience listing methods
	const passwordSummaries = await mockVaultClient.listPasswords();
	assert.equal(passwordSummaries.length, SYNTHETIC_PASSWORDS.length);

	const apiKeySummaries = await mockVaultClient.listApiKeys();
	assert.equal(apiKeySummaries.length, SYNTHETIC_API_KEYS.length);

	if (mockVaultClient.listOAuth2Credentials) {
		const oauthSummaries = await mockVaultClient.listOAuth2Credentials();
		assert.equal(oauthSummaries.length, SYNTHETIC_OAUTH2.length);
	}
	if (mockVaultClient.listSecureNotes) {
		const noteSummaries = await mockVaultClient.listSecureNotes();
		assert.equal(noteSummaries.length, SYNTHETIC_SECURE_NOTES.length);
	}

	// Test 6: Detail retrieval preserves secrets and specialized metadata
	console.log('Test 6: Credential detail retrieval and metadata fidelity');
	const oauthItem = await mockVaultClient.getCredential('cred-008');
	assert.equal(oauthItem.kind, 'oauth2');
	assert.ok(oauthItem.secret, 'Detail must include secret');
	assert.equal(
		oauthItem.oauth2Metadata?.clientId,
		'729103847291-aegis-app.apps.googleusercontent.com',
	);
	assert.equal(oauthItem.oauth2Metadata?.grantType, 'authorization_code');

	const sshItem = await mockVaultClient.getCredential('cred-005');
	assert.equal(sshItem.kind, 'ssh-key');
	assert.equal(sshItem.sshKeyMetadata?.keyType, 'ed25519');

	const noteItem = await mockVaultClient.getCredential('cred-010');
	assert.equal(noteItem.kind, 'secure-note');
	assert.equal(noteItem.secureNoteMetadata?.format, 'markdown');
	assert.ok(noteItem.notes?.includes('Emergency Breakglass Procedure'));

	// Test 7: Credential creation across diverse types
	console.log('Test 7: Credential creation and activity event logging');
	const newOAuthInput: CreateCredentialInput = {
		kind: 'oauth2',
		title: 'Slack App Bot Token',
		category: 'Communications',
		tags: ['slack', 'oauth2', 'bot'],
		secret: 'xoxb-test-mock-secret-token',
		notes: 'Slack Bot Integration with channels:read scope',
		oauth2Metadata: {
			clientId: 'slack_client_9941',
			tokenUrl: 'https://slack.com/api/oauth.v2.access',
			grantType: 'authorization_code',
			scopes: ['chat:write', 'channels:read'],
		},
	};
	const createdSummary = await mockVaultClient.createCredential(newOAuthInput);
	assert.ok(createdSummary.id, 'Created summary must receive generated ID');
	assert.equal(createdSummary.title, 'Slack App Bot Token');
	assert.equal(createdSummary.kind, 'oauth2');

	const createdDetail = await mockVaultClient.getCredential(createdSummary.id);
	assert.equal(createdDetail.secret, 'xoxb-test-mock-secret-token');
	assert.equal(createdDetail.oauth2Metadata?.clientId, 'slack_client_9941');

	// Verify activity log reflects creation
	const activitiesAfterCreate = await mockVaultClient.getActivity();
	const createEvent = activitiesAfterCreate.find(
		(a) => a.type === 'credential_created' && a.title.includes('Slack App Bot Token'),
	);
	assert.ok(createEvent, 'Activity event must be logged for credential creation');
	assert.equal(createEvent.credentialKind, 'oauth2');

	// Test 8: Credential update and metadata modification
	console.log('Test 8: Credential update with metadata modification');
	const updateInput: UpdateCredentialInput = {
		title: 'Slack App Bot Token (Production)',
		tags: ['slack', 'oauth2', 'bot', 'production'],
		oauth2Metadata: {
			expiresAt: '2028-01-01T00:00:00Z',
		},
	};
	const updatedSummary = await mockVaultClient.updateCredential(createdSummary.id, updateInput);
	assert.equal(updatedSummary.title, 'Slack App Bot Token (Production)');
	assert.deepEqual(updatedSummary.tags, ['slack', 'oauth2', 'bot', 'production']);

	const updatedDetail = await mockVaultClient.getCredential(createdSummary.id);
	assert.equal(updatedDetail.title, 'Slack App Bot Token (Production)');
	// Existing client ID preserved while expiresAt updated
	assert.equal(updatedDetail.oauth2Metadata?.clientId, 'slack_client_9941');
	assert.equal(updatedDetail.oauth2Metadata?.expiresAt, '2028-01-01T00:00:00Z');

	// Test 9: Credential deletion and verification
	console.log('Test 9: Credential deletion and removal confirmation');
	await mockVaultClient.deleteCredential(createdSummary.id);

	await assert.rejects(
		async () => await mockVaultClient.getCredential(createdSummary.id),
		/Credential not found/,
		'Deleted credential must not be retrievable',
	);

	const activitiesAfterDelete = await mockVaultClient.getActivity();
	const deleteEvent = activitiesAfterDelete.find(
		(a) => a.type === 'credential_deleted' && a.title.includes('Slack App Bot Token (Production)'),
	);
	assert.ok(deleteEvent, 'Activity event must be logged for credential deletion');

	// Test 10: Reset utility restores clean baseline
	console.log('Test 10: Reset utility restores baseline state');
	resetMockVaultClient();
	assert.equal(mockVaultClient.isUnlocked(), false, 'Reset must return client to locked state');

	console.log('\nAll PR 2 Credential Models & Mock Service tests passed cleanly!\n');
}

runTests().catch((err) => {
	console.error('Test failure:', err);
	process.exit(1);
});
