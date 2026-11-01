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

// Test 2: Secret visibility interaction and security hygiene
console.log('Test 2: Secret reveal/conceal security hygiene');
assert.ok(
	credentialListContent.includes('revealedId === store.selectedCredential.id'),
	'Secret must only render when revealedId matches selected credential ID',
);
assert.ok(
	credentialListContent.includes('••••••••••••••••••••••••'),
	'Concealed state must show masked placeholder without rendering actual secret in DOM',
);
assert.ok(
	credentialListContent.includes('autoConcealTimer'),
	'Secret visibility must support auto-conceal timeout for security',
);
assert.ok(
	credentialListContent.includes('blur(4px)'),
	'Secret reveal must provide smooth blur transition without disruptive layout shift',
);

// Test 3: Type-specific metadata detail blocks
console.log('Test 3: Type-specific metadata detail blocks (OAuth2, SSH, API Key, Note)');
assert.ok(
	credentialListContent.includes('OAuth2 Client Configuration') ||
		credentialListContent.includes('oauth2Metadata'),
	'Detail view must provide dedicated OAuth2 metadata rendering',
);
assert.ok(
	credentialListContent.includes('SSH Key Specifications') ||
		credentialListContent.includes('sshKeyMetadata'),
	'Detail view must provide dedicated SSH key metadata rendering',
);
assert.ok(
	credentialListContent.includes('API Configuration & Telemetry') ||
		credentialListContent.includes('apiKeyMetadata'),
	'Detail view must provide dedicated API Key / Access Token telemetry rendering',
);
assert.ok(
	credentialListContent.includes('Secure Note Properties') ||
		credentialListContent.includes('secureNoteMetadata'),
	'Detail view must provide dedicated Secure Note metadata rendering',
);

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
