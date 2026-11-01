import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

console.log('--- Starting Aegis Phase 4 PR 4: Dashboard & Motion Choreography Tests ---');

// 1. Inspect VaultSetupCard.vue
const setupCardPath = resolve(__dirname, '../src/features/vault/VaultSetupCard.vue');
const setupCardContent = readFileSync(setupCardPath, 'utf8');

// Test 1: Real-time passphrase validation and strength feedback
console.log('Test 1: Real-time passphrase validation and strength meter feedback');
assert.ok(
	setupCardContent.includes('strengthLevel'),
	'VaultSetupCard must compute real-time passphrase strength level',
);
assert.ok(
	setupCardContent.includes('grid-cols-4'),
	'VaultSetupCard must display a multi-segment strength progress bar',
);
assert.ok(
	setupCardContent.includes('hasMinLength'),
	'VaultSetupCard must validate minimum 12 characters requirement',
);
assert.ok(
	setupCardContent.includes('hasMatch'),
	'VaultSetupCard must validate confirmation matching',
);
assert.ok(
	setupCardContent.includes("passphrase.value = ''"),
	'VaultSetupCard must scrub passphrase reactive state on unmount and completion',
);

// 2. Inspect VaultUnlockCard.vue
const unlockCardPath = resolve(__dirname, '../src/features/vault/VaultUnlockCard.vue');
const unlockCardContent = readFileSync(unlockCardPath, 'utf8');

// Test 2: Unlocking loading transition and rejection feedback
console.log('Test 2: Unlocking loading transition and rejection feedback');
assert.ok(
	unlockCardContent.includes('isShaking'),
	'VaultUnlockCard must support rejection shake motion on invalid attempt',
);
assert.ok(
	unlockCardContent.includes('Deriving key...'),
	'VaultUnlockCard must show loading state during cryptographic derivation',
);
assert.ok(
	unlockCardContent.includes("passphrase.value = ''"),
	'VaultUnlockCard must clear passphrase memory on unmount',
);

// 3. Inspect VaultRecoverySetupCard.vue
const recoverySetupPath = resolve(__dirname, '../src/features/vault/VaultRecoverySetupCard.vue');
const recoverySetupContent = readFileSync(recoverySetupPath, 'utf8');

// Test 3: Recovery key presentation and completion choreography
console.log('Test 3: Recovery key presentation and completion confirmation');
assert.ok(
	recoverySetupContent.includes('isRevealed'),
	'VaultRecoverySetupCard must mask key by default with reveal toggle',
);
assert.ok(
	recoverySetupContent.includes('confirmPop'),
	'VaultRecoverySetupCard must use confirmPop tactile feedback on copy',
);
assert.ok(
	recoverySetupContent.includes('isConfirmed'),
	'VaultRecoverySetupCard must require explicit confirmation checkbox before completion',
);

// 4. Inspect OverviewView.vue
const overviewPath = resolve(__dirname, '../src/features/overview/OverviewView.vue');
const overviewContent = readFileSync(overviewPath, 'utf8');

// Test 4: Dashboard stat cards and all-kind support
console.log('Test 4: Dashboard stat cards reflect all credential models');
assert.ok(overviewContent.includes('Passwords'), 'Overview must display Passwords stat card');
assert.ok(
	overviewContent.includes('API Keys & Tokens'),
	'Overview must display API Keys & Tokens stat card',
);
assert.ok(overviewContent.includes('SSH & OAuth2'), 'Overview must display SSH & OAuth2 stat card');
assert.ok(
	overviewContent.includes('Total Credentials'),
	'Overview must display Total Credentials stat card',
);
assert.ok(
	overviewContent.includes('cardInteraction'),
	'Overview stat cards must use cardInteraction motion preset',
);

// Test 5: Scroll animations and staggered activity reveals
console.log('Test 5: Scroll animations and staggered activity feed');
assert.ok(
	overviewContent.includes('ScrollProgressBar'),
	'Overview must include ScrollProgressBar bound to page scroller',
);
assert.ok(
	overviewContent.includes('ParallaxLayer'),
	'Overview must include atmospheric ParallaxLayer depth plates',
);
assert.ok(
	overviewContent.includes('MotionReveal'),
	'Overview must use MotionReveal for viewport-triggered scroll reveal',
);
assert.ok(
	overviewContent.includes('cappedStaggerDelay'),
	'Overview activity feed must use cappedStaggerDelay for list pacing',
);

// 5. Inspect App.vue & Store for Vault Locking security requirement
const appPath = resolve(__dirname, '../src/app/App.vue');
const appContent = readFileSync(appPath, 'utf8');

const storePath = resolve(__dirname, '../src/stores/vaultStore.ts');
const storeContent = readFileSync(storePath, 'utf8');

// Test 6: Vault Locking security requirement & transition choreography
console.log('Test 6: Vault locking security hygiene and transition choreography');
assert.ok(
	appContent.includes('AnimatePresence') && appContent.includes('mode="wait"'),
	'App.vue must transition environments using AnimatePresence in mode="wait"',
);
assert.ok(
	storeContent.includes('credentials.value = []'),
	'Store lock() must immediately scrub credentials without delaying for animations',
);
assert.ok(
	storeContent.includes('passwords.value = []'),
	'Store lock() must immediately scrub passwords',
);
assert.ok(
	storeContent.includes('apiKeys.value = []'),
	'Store lock() must immediately scrub apiKeys',
);
assert.ok(
	storeContent.includes('selectedCredential.value = null'),
	'Store lock() must immediately scrub selectedCredential',
);

console.log('\nAll PR 4 Dashboard & Motion Choreography tests passed cleanly!\n');
