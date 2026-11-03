import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

console.log('--- Starting Aegis Phase 4 PR 3: Unified Credential Management Tests ---');

// 1. Inspect CredentialList.vue source
const credentialListPath = resolve(__dirname, '../src/components/vault/CredentialList.vue');
const credentialListContent = readFileSync(credentialListPath, 'utf8');

// Test 1: CredentialList unified multi-kind support
console.log('Test 1: CredentialList multi-kind and allowedKinds support');
assert.ok(
	credentialListContent.includes('allowedKinds?: CredentialKind[]'),
	'CredentialList must accept optional allowedKinds prop',
);
assert.ok(
	credentialListContent.includes('selectedKindFilter'),
	'CredentialList must support kind-based filter switching',
);
assert.ok(
	credentialListContent.includes('selectedCategory'),
	'CredentialList must support category filtering',
);
assert.ok(
	credentialListContent.includes('AppBadge'),
	'CredentialList must use AppBadge for item kind badges',
);

// Test 2: Secret visibility interaction and security hygiene.
// The security lifecycle now lives in the dedicated SecretField primitive
// (design spec §5.3), so the assertions target that component.
console.log('Test 2: Secret reveal/conceal security hygiene');
const secretFieldPath = resolve(__dirname, '../src/components/vault/detail/SecretField.vue');
const secretFieldContent = readFileSync(secretFieldPath, 'utf8');
assert.ok(
	secretFieldContent.includes('revealed'),
	'SecretField must gate rendering on an explicit reveal state',
);
assert.ok(
	secretFieldContent.includes('••••••••••••••••••••••••'),
	'Concealed state must show masked placeholder without rendering actual secret in DOM',
);
assert.ok(
	secretFieldContent.includes('autoConcealTimer'),
	'Secret visibility must support auto-conceal timeout for security',
);
assert.ok(
	secretFieldContent.includes('blur(4px)'),
	'Secret reveal must provide smooth blur transition without disruptive layout shift',
);

// Test 3: Type-specific metadata detail components
console.log('Test 3: Type-specific metadata detail components (OAuth2, SSH, API Key, Note)');
const detailDir = resolve(__dirname, '../src/components/vault/detail');
const apiKeyDetailContent = readFileSync(resolve(detailDir, 'ApiKeyDetail.vue'), 'utf8');
const sshKeyDetailContent = readFileSync(resolve(detailDir, 'SshKeyDetail.vue'), 'utf8');
const oauth2DetailContent = readFileSync(resolve(detailDir, 'OAuth2Detail.vue'), 'utf8');
const secureNoteDetailContent = readFileSync(resolve(detailDir, 'SecureNoteDetail.vue'), 'utf8');

assert.ok(
	oauth2DetailContent.includes('OAuth2 Client Configuration'),
	'Detail view must provide dedicated OAuth2 metadata rendering',
);
assert.ok(
	sshKeyDetailContent.includes('SSH Key Specifications'),
	'Detail view must provide dedicated SSH key metadata rendering',
);
assert.ok(
	apiKeyDetailContent.includes('API Configuration'),
	'Detail view must provide dedicated API Key / Access Token telemetry rendering',
);
assert.ok(
	secureNoteDetailContent.includes('Secure Note Properties'),
	'Detail view must provide dedicated Secure Note metadata rendering',
);
for (const component of [
	'<SecretField',
	'<ApiKeyDetail',
	'<SshKeyDetail',
	'<OAuth2Detail',
	'<SecureNoteDetail',
]) {
	assert.ok(
		credentialListContent.includes(component),
		`CredentialList must delegate detail rendering to ${component}>`,
	);
}

// Test 4: ModalShell integration and Dialog confirmation
console.log('Test 4: ModalShell and AppDialog confirmation integration');
assert.ok(
	credentialListContent.includes('<ModalShell'),
	'CredentialList must use ModalShell for creation and editing',
);
assert.ok(
	credentialListContent.includes('<AppDialog'),
	'CredentialList must use AppDialog for deletion confirmation',
);
assert.ok(
	credentialListContent.includes(':danger="true"'),
	'Deletion modal must use danger styling',
);

// 2. Inspect CredentialForm.vue source
const credentialFormPath = resolve(__dirname, '../src/components/vault/CredentialForm.vue');
const credentialFormContent = readFileSync(credentialFormPath, 'utf8');

// Test 5: CredentialForm all-kind support
console.log('Test 5: CredentialForm kind switcher and dynamic form fields');
assert.ok(credentialFormContent.includes("'password'"), 'Form must support password kind');
assert.ok(credentialFormContent.includes("'api-key'"), 'Form must support api-key kind');
assert.ok(credentialFormContent.includes("'access-token'"), 'Form must support access-token kind');
assert.ok(credentialFormContent.includes("'ssh-key'"), 'Form must support ssh-key kind');
assert.ok(credentialFormContent.includes("'oauth2'"), 'Form must support oauth2 kind');
assert.ok(credentialFormContent.includes("'secure-note'"), 'Form must support secure-note kind');

// Test 6: Form validation and strict typing
console.log('Test 6: Form validation and strict TypeScript payload emission');
assert.ok(
	credentialFormContent.includes('validate(): boolean'),
	'CredentialForm must validate input requirements',
);
assert.ok(
	credentialFormContent.includes("errs.title = 'Title is required'"),
	'CredentialForm must enforce title requirement',
);
assert.ok(!credentialFormContent.includes(': any'), 'CredentialForm must not use any types');
assert.ok(
	credentialFormContent.includes('formStyles'),
	'CredentialForm must use standardized formStyles tokens',
);

// 3. Inspect PasswordsView and ApiKeysView source
const passwordsViewPath = resolve(__dirname, '../src/features/passwords/PasswordsView.vue');
const passwordsViewContent = readFileSync(passwordsViewPath, 'utf8');

const apiKeysViewPath = resolve(__dirname, '../src/features/apikeys/ApiKeysView.vue');
const apiKeysViewContent = readFileSync(apiKeysViewPath, 'utf8');

// Test 7: Views delegate to unified CredentialList
console.log('Test 7: PasswordsView and ApiKeysView delegate to unified CredentialList');
assert.ok(
	passwordsViewContent.includes('<CredentialList'),
	'PasswordsView must delegate to unified CredentialList',
);
assert.ok(
	apiKeysViewContent.includes('<CredentialList'),
	'ApiKeysView must delegate to unified CredentialList',
);
assert.ok(
	apiKeysViewContent.includes('default-kind="api-key"'),
	'ApiKeysView must default to api-key',
);

console.log('\nAll PR 3 Unified Credential Management tests passed cleanly!\n');
