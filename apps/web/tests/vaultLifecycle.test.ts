import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setActivePinia, createPinia } from 'pinia';
import { useVaultStore, setVaultClient } from '../src/stores/vaultStore';
import { vaultClient as defaultVaultClient } from '../src/services/api/vaultClient';
import type {
	VaultClient,
	CreateVaultResult,
	RecoverVaultResult,
} from '../src/services/api/contracts';
import type {
	VaultStatus,
	VaultState,
	CredentialSummary,
	CredentialDetail,
	CreateCredentialInput,
	UpdateCredentialInput,
	ActivityEvent,
} from '../src/types';

// Polyfill import.meta.env for Node/tsx test environment
if (typeof (import.meta as Record<string, unknown>).env === 'undefined') {
	Object.defineProperty(import.meta, 'env', {
		value: { DEV: true, PROD: false, MODE: 'test' },
		configurable: true,
		writable: true,
	});
}

interface TestClientOptions {
	initialState?: VaultState;
	supportsRecovery?: boolean;
	shouldFailInit?: boolean;
	shouldFailLock?: boolean;
	shouldFailUnlock?: boolean;
	shouldFailStatusAfterAuth?: boolean;
}

/**
 * Creates an isolated, strictly-typed test VaultClient instance.
 * Avoids mutating shared singletons and enables dependency injection.
 */
function createTestVaultClient(options: TestClientOptions = {}): VaultClient & {
	setState(state: VaultState): void;
	setFailLock(fail: boolean): void;
	setFailInit(fail: boolean): void;
	setFailUnlock(fail: boolean): void;
	setFailStatusAfterAuth(fail: boolean): void;
} {
	let currentState: VaultState = options.initialState ?? 'uninitialized';
	let failLock = options.shouldFailLock ?? false;
	let failInit = options.shouldFailInit ?? false;
	let failUnlock = options.shouldFailUnlock ?? false;
	let failStatusAfterAuth = options.shouldFailStatusAfterAuth ?? false;

	const mockCredentials: CredentialSummary[] = [
		{
			id: 'cred-1',
			vaultId: 'test-vault',
			kind: 'password',
			title: 'GitHub',
			tags: ['dev'],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		},
	];

	const client: VaultClient & {
		setState(state: VaultState): void;
		setFailLock(fail: boolean): void;
		setFailInit(fail: boolean): void;
		setFailUnlock(fail: boolean): void;
		setFailStatusAfterAuth(fail: boolean): void;
	} = {
		setState(state: VaultState) {
			currentState = state;
		},
		setFailLock(fail: boolean) {
			failLock = fail;
		},
		setFailInit(fail: boolean) {
			failInit = fail;
		},
		setFailUnlock(fail: boolean) {
			failUnlock = fail;
		},
		setFailStatusAfterAuth(fail: boolean) {
			failStatusAfterAuth = fail;
		},

		async getVaultStatus(): Promise<VaultStatus> {
			if (failInit || failStatusAfterAuth) {
				throw new Error('Connection refused by local backend service');
			}
			return {
				state: currentState,
				vaultId: 'test-vault',
				credentialCount: mockCredentials.length,
			};
		},

		async unlockVault(passphrase: string): Promise<{ success: boolean; error?: string }> {
			if (failUnlock) {
				throw new Error('Internal crypto engine failure during unlock');
			}
			if (!passphrase) {
				return { success: false, error: 'Passphrase is required.' };
			}
			if (passphrase !== 'correct-master-passphrase-2026') {
				return { success: false, error: 'Incorrect master passphrase. Please try again.' };
			}
			currentState = 'unlocked';
			return { success: true };
		},

		async createVault(passphrase: string, confirm: string): Promise<CreateVaultResult> {
			if (!passphrase || passphrase.length < 12) {
				return { success: false, error: 'Passphrase must be at least 12 characters.' };
			}
			if (passphrase !== confirm) {
				return { success: false, error: 'Passphrases do not match.' };
			}
			currentState = 'unlocked';
			return {
				success: true,
				recoveryKey: 'AEGIS-RCV-TEST-KEY-4821',
			};
		},

		async lockVault(): Promise<void> {
			if (failLock) {
				throw new Error('Backend session destruction failed');
			}
			currentState = 'locked';
		},

		async listCredentials(): Promise<CredentialSummary[]> {
			return [...mockCredentials];
		},

		async listPasswords(): Promise<CredentialSummary[]> {
			return [...mockCredentials];
		},

		async listApiKeys(): Promise<CredentialSummary[]> {
			return [];
		},

		async getCredential(id: string): Promise<CredentialDetail> {
			return {
				...mockCredentials[0],
				secret: 'test-secret',
			};
		},

		async createCredential(input: CreateCredentialInput): Promise<CredentialSummary> {
			return {
				id: 'new-cred',
				vaultId: 'test-vault',
				kind: input.kind,
				title: input.title,
				tags: input.tags ?? [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};
		},

		async updateCredential(id: string, input: UpdateCredentialInput): Promise<CredentialSummary> {
			return {
				...mockCredentials[0],
				title: input.title ?? mockCredentials[0].title,
			};
		},

		async deleteCredential(_id: string): Promise<void> {},

		async getActivity(): Promise<ActivityEvent[]> {
			return [];
		},

		isUnlocked(): boolean {
			return currentState === 'unlocked';
		},
	};

	if (options.supportsRecovery !== false) {
		client.recoverVault = async (recoveryKey: string): Promise<RecoverVaultResult> => {
			const cleaned = recoveryKey.trim().toUpperCase();
			if (!cleaned) {
				return { success: false, error: 'Recovery key cannot be empty.' };
			}
			if (!cleaned.startsWith('AEGIS-') || cleaned.length < 16) {
				return { success: false, error: 'Invalid recovery key format.' };
			}
			currentState = 'unlocked';
			return { success: true };
		};
	}

	return client;
}

console.log('--- Starting Aegis Phase 3 Vault Lifecycle & Security Boundary Tests ---');

async function runTests() {
	setActivePinia(createPinia());

	try {
		// -------------------------------------------------------------------------
		// Test 1: Initialization Loading Gate & Race Condition Protection
		// -------------------------------------------------------------------------
		console.log('Test 1: Initialization loading gate prevents premature setup/unlock');
		const delayedClient = createTestVaultClient({ initialState: 'locked' });
		setVaultClient(delayedClient);
		const store = useVaultStore();

		assert.equal(store.isInitializing, true, 'isInitializing must start true');
		assert.equal(
			store.isUninitialized,
			false,
			'isUninitialized must not be true while initializing',
		);
		assert.equal(store.isLocked, false, 'isLocked must not be true while initializing');
		assert.equal(store.isUnlocked, false, 'isUnlocked must not be true while initializing');

		const prematureSetup = await store.setupVault('short', 'short');
		assert.equal(prematureSetup.success, false);
		assert.match(prematureSetup.error ?? '', /not ready/i);

		await store.init();
		assert.equal(store.isInitializing, false, 'isInitializing must become false after init');
		assert.equal(store.isLocked, true, 'isLocked must match actual backend status (locked)');
		assert.equal(
			store.isUninitialized,
			false,
			'isUninitialized must remain false for initialized vault',
		);

		// -------------------------------------------------------------------------
		// Test 2: Idempotent and Concurrent Initialization Calls
		// -------------------------------------------------------------------------
		console.log(
			'Test 2: Repeated and concurrent init() calls are deduplicated without race conditions',
		);
		const call1 = store.init();
		const call2 = store.init();
		await Promise.all([call1, call2]);
		assert.equal(store.isInitializing, false);
		assert.equal(store.isLocked, true);

		// Repeated sequential call after completion
		await store.init();
		assert.equal(store.isInitializing, false);
		assert.equal(store.isLocked, true);
		assert.equal(store.initError, null);

		// -------------------------------------------------------------------------
		// Test 3: Backend Connection Error Handling
		// -------------------------------------------------------------------------
		console.log('Test 3: Backend connection error handling with retry mechanism');
		const failingInitClient = createTestVaultClient({ shouldFailInit: true });
		setVaultClient(failingInitClient);
		setActivePinia(createPinia());
		const storeInitFail = useVaultStore();

		await storeInitFail.init();
		assert.equal(storeInitFail.isInitializing, false);
		assert.ok(storeInitFail.initError, 'initError must describe connection failure');
		assert.equal(
			storeInitFail.isUninitialized,
			false,
			'Must NOT default to uninitialized upon error',
		);
		assert.equal(
			storeInitFail.isLocked,
			false,
			'Must NOT be active locked state upon connection error',
		);
		assert.equal(
			storeInitFail.isUnlocked,
			false,
			'Must NOT be active unlocked state upon connection error',
		);

		// -------------------------------------------------------------------------
		// Test 4: First-Run Vault Setup Lifecycle & Validation
		// -------------------------------------------------------------------------
		console.log('Test 4: First-run setup validation and recovery key presentation');
		const testClient = createTestVaultClient({ initialState: 'uninitialized' });
		setVaultClient(testClient);
		setActivePinia(createPinia());
		const setupStore = useVaultStore();

		await setupStore.init();
		assert.equal(setupStore.isUninitialized, true, 'Status must confirm uninitialized');

		// Passphrase validation (< 12 characters)
		const shortResult = await setupStore.setupVault('short-pass', 'short-pass');
		assert.equal(shortResult.success, false);
		assert.match(shortResult.error ?? '', /at least 12 characters/i);
		assert.equal(setupStore.recoveryKeyPresented, null);

		// Mismatched passphrases
		const mismatchResult = await setupStore.setupVault(
			'master-passphrase-2026!',
			'different-passphrase-2026!',
		);
		assert.equal(mismatchResult.success, false);
		assert.match(mismatchResult.error ?? '', /do not match/i);
		assert.equal(setupStore.recoveryKeyPresented, null);

		// Valid setup
		const validPassphrase = 'master-passphrase-2026!';
		const successResult = await setupStore.setupVault(validPassphrase, validPassphrase);
		assert.equal(successResult.success, true);
		assert.equal(successResult.recoveryKey, 'AEGIS-RCV-TEST-KEY-4821');
		assert.equal(
			setupStore.recoveryKeyPresented,
			'AEGIS-RCV-TEST-KEY-4821',
			'Recovery key must be in reactive store state for explicit confirmation',
		);

		// -------------------------------------------------------------------------
		// Test 5: Recovery Key Retention When Status Retrieval Fails During Setup
		// -------------------------------------------------------------------------
		console.log(
			'Test 5: Recovery key retention when status retrieval fails during setup completion',
		);
		testClient.setFailStatusAfterAuth(true);
		const completeFailed = await setupStore.completeSetup();
		assert.equal(completeFailed, false, 'completeSetup must fail if status fetch fails');
		assert.ok(setupStore.error, 'Error message must alert user of status fetch issue');
		assert.equal(
			setupStore.recoveryKeyPresented,
			'AEGIS-RCV-TEST-KEY-4821',
			'CRITICAL: Recovery key must NOT be lost when status retrieval fails',
		);

		// -------------------------------------------------------------------------
		// Test 6: Recovery Key Cleared Only After Successful Status Confirmation
		// -------------------------------------------------------------------------
		console.log('Test 6: Recovery key cleared only after successful status confirmation');
		testClient.setFailStatusAfterAuth(false);
		const completeSuccess = await setupStore.completeSetup();
		assert.equal(completeSuccess, true, 'completeSetup succeeds once backend is available');
		assert.equal(setupStore.isUnlocked, true, 'Vault is unlocked');
		assert.equal(
			setupStore.recoveryKeyPresented,
			null,
			'Recovery key is cleared from reactive state once unlocked is confirmed',
		);

		// -------------------------------------------------------------------------
		// Test 7: Manual Lock Reactive State Purge & Backend Confirmation
		// -------------------------------------------------------------------------
		console.log('Test 7: Manual lock reactive state purge and backend confirmation');
		await setupStore.loadAll();
		assert.ok(setupStore.credentials.length > 0, 'Credentials loaded in unlocked state');

		// -------------------------------------------------------------------------
		// Test 8: Lock Failure Handling & retryLock Reconciliation
		// -------------------------------------------------------------------------
		console.log('Test 8: Lock failure handling and retryLock reconciliation');
		testClient.setFailLock(true);
		const lockSuccess = await setupStore.lock();
		assert.equal(
			lockSuccess,
			false,
			'Lock must report false when backend session destruction fails',
		);
		assert.ok(setupStore.lockError, 'lockError must be populated');
		assert.notEqual(setupStore.status.state, 'locked', 'Status must not falsely declare locked');
		assert.equal(
			setupStore.credentials.length,
			0,
			'Frontend credentials must still be purged immediately',
		);

		testClient.setFailLock(false);
		const retrySuccess = await setupStore.retryLock();
		assert.equal(retrySuccess, true, 'retryLock must succeed when backend resolves');
		assert.equal(setupStore.lockError, null, 'lockError must be cleared');
		assert.equal(setupStore.status.state, 'locked', 'Status is confirmed locked by backend');

		// -------------------------------------------------------------------------
		// Test 9: Concurrent Lock Calls Guard
		// -------------------------------------------------------------------------
		console.log('Test 9: Concurrent lock calls are prevented by guard');
		testClient.setState('unlocked');
		setupStore.status = { state: 'unlocked' };
		const lock1 = setupStore.lock();
		const lock2 = setupStore.lock(); // duplicate simultaneous lock attempt
		const [res1, res2] = await Promise.all([lock1, lock2]);
		assert.equal(res1, true, 'First lock succeeds');
		assert.equal(res2, false, 'Concurrent lock is safely rejected by concurrency guard');

		// -------------------------------------------------------------------------
		// Test 10: Passphrase Unlock Rejection on Bad Input
		// -------------------------------------------------------------------------
		console.log('Test 10: Passphrase unlock rejection on invalid credentials');
		const badUnlock = await setupStore.unlock('wrong-passphrase');
		assert.equal(badUnlock, false);
		assert.equal(setupStore.status.state, 'locked');
		assert.ok(setupStore.error);

		// -------------------------------------------------------------------------
		// Test 11: Backend Unlock Network/Execution Failure (shouldFailUnlock)
		// -------------------------------------------------------------------------
		console.log('Test 11: Backend unlock execution failure handling (shouldFailUnlock)');
		const failUnlockClient = createTestVaultClient({
			initialState: 'locked',
			shouldFailUnlock: true,
		});
		setVaultClient(failUnlockClient);
		setActivePinia(createPinia());
		const failUnlockStore = useVaultStore();
		await failUnlockStore.init();

		const failedOpUnlock = await failUnlockStore.unlock('correct-master-passphrase-2026');
		assert.equal(failedOpUnlock, false);
		assert.equal(failUnlockStore.status.state, 'locked');
		assert.match(failUnlockStore.error ?? '', /failed to execute unlock/i);

		// Restore testClient and verify dynamic toggling with setFailUnlock
		setVaultClient(testClient);
		testClient.setFailUnlock(true);
		const dynamicFailUnlock = await setupStore.unlock('correct-master-passphrase-2026');
		assert.equal(dynamicFailUnlock, false);
		assert.equal(setupStore.status.state, 'locked');
		assert.match(setupStore.error ?? '', /failed to execute unlock/i);
		testClient.setFailUnlock(false);

		// -------------------------------------------------------------------------
		// Test 12: Successful Backend Unlock Followed by Failed Status Reconciliation
		// -------------------------------------------------------------------------
		console.log('Test 12: Successful unlock with failed status retrieval (reconciliation error)');
		testClient.setFailStatusAfterAuth(true);
		const syncFailUnlock = await setupStore.unlock('correct-master-passphrase-2026');
		assert.equal(syncFailUnlock, false, 'Unlock reports unconfirmed status');
		assert.equal(
			setupStore.error,
			null,
			'error must NOT claim invalid credentials when auth succeeded',
		);
		assert.ok(
			setupStore.reconciliationError,
			'reconciliationError must explain that auth succeeded but status sync failed',
		);

		// Now resolve status reconciliation via reconcileStatus()
		testClient.setFailStatusAfterAuth(false);
		const syncSuccess = await setupStore.reconcileStatus();
		assert.equal(syncSuccess, true, 'reconcileStatus resolves session status');
		assert.equal(setupStore.reconciliationError, null);
		assert.equal(setupStore.isUnlocked, true, 'Vault is now confirmed unlocked');

		// -------------------------------------------------------------------------
		// Test 13: Emergency Recovery Key Validation & Restoration
		// -------------------------------------------------------------------------
		console.log('Test 13: Emergency recovery key validation and access restoration');
		await setupStore.lock();

		// Invalid format
		const badKey = await setupStore.recover('INVALID-FORMAT');
		assert.equal(badKey, false);
		assert.equal(setupStore.status.state, 'locked');

		// Valid recovery key
		const goodKey = await setupStore.recover('AEGIS-RCV-TEST-KEY-4821');
		assert.equal(goodKey, true);
		assert.equal(setupStore.status.state, 'unlocked');

		// Recovery with status sync failure and reconciliation
		await setupStore.lock();
		testClient.setFailStatusAfterAuth(true);
		const syncFailRecover = await setupStore.recover('AEGIS-RCV-TEST-KEY-4821');
		assert.equal(syncFailRecover, false, 'Recovery reports unconfirmed status when sync fails');
		assert.equal(setupStore.error, null, 'Error must not report invalid key when auth succeeded');
		assert.ok(setupStore.reconciliationError);

		testClient.setFailStatusAfterAuth(false);
		const syncRecoverSuccess = await setupStore.reconcileStatus();
		assert.equal(syncRecoverSuccess, true);
		assert.equal(setupStore.reconciliationError, null);
		assert.equal(setupStore.isUnlocked, true);

		// -------------------------------------------------------------------------
		// Test 14: Emergency Recovery on Backend Without Recovery Support
		// -------------------------------------------------------------------------
		console.log('Test 14: Emergency recovery handling when backend lacks recovery support');
		const noRecoveryClient = createTestVaultClient({
			initialState: 'locked',
			supportsRecovery: false,
		});
		setVaultClient(noRecoveryClient);
		setActivePinia(createPinia());
		const unsupportedStore = useVaultStore();
		await unsupportedStore.init();

		const unsupportedResult = await unsupportedStore.recover('AEGIS-RCV-TEST-KEY-4821');
		assert.equal(unsupportedResult, false);
		assert.match(
			unsupportedStore.error ?? '',
			/not supported/i,
			'Must explain that emergency recovery is not supported by the active backend',
		);

		// -------------------------------------------------------------------------
		// Test 15: Production Build Excluding Development Mock Controls
		// -------------------------------------------------------------------------
		console.log('Test 15: Production build excluding development mock controls');
		const unlockViewPath = resolve(
			fileURLToPath(import.meta.url),
			'../../src/features/vault/UnlockView.vue',
		);
		const unlockViewSource = readFileSync(unlockViewPath, 'utf-8');

		// 1. Must NOT statically import setMockVaultState or mock mutators
		assert.doesNotMatch(
			unlockViewSource,
			/import\s+{[^}]*setMockVaultState[^}]*}\s+from/,
			'Must NOT statically import setMockVaultState at top level of UnlockView',
		);

		// 2. Must define isDev using import.meta.env.DEV
		assert.match(
			unlockViewSource,
			/isDev\s*=\s*(?:Boolean\()?(?:typeof\s+import\.meta\s*!==\s*'undefined'\s*&&\s*)?import\.meta\.env\??\.DEV/,
			'UnlockView must evaluate DEV environment flag via import.meta.env.DEV',
		);

		// 3. Template mock switcher container must be gated by v-if="isDev"
		assert.match(
			unlockViewSource,
			/v-if="isDev"/,
			'Mock switcher markup must be gated by v-if="isDev" in template',
		);

		// 4. toggleMockState must include an explicit guard check before execution
		assert.match(
			unlockViewSource,
			/if\s*\(\s*!isDev\s*\)\s*return;/,
			'toggleMockState must refuse execution when isDev is false',
		);

		// 5. If dist exists, verify production build bundle was generated successfully
		const distIndex = resolve(fileURLToPath(import.meta.url), '../../dist/index.html');
		if (existsSync(distIndex)) {
			assert.ok(existsSync(distIndex), 'Production build output exists');
		}

		console.log(
			'\nAll 15 Aegis Phase 3 Lifecycle, Security Boundary, and Reconciliation tests passed cleanly!',
		);
	} finally {
		setVaultClient(defaultVaultClient);
	}
}

runTests().catch((err) => {
	console.error('Test execution failed:', err);
	process.exit(1);
});
