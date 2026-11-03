// Vault Store — Pinia store for vault state management

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
	CredentialSummary,
	CredentialDetail,
	VaultStatus,
	ActivityEvent,
	AppNotification,
	CredentialFilters,
	CreateCredentialInput,
	UpdateCredentialInput,
	PageId,
} from '@/types';
import type { VaultClient, CreateVaultResult } from '@/services/api/contracts';
import { vaultClient as defaultVaultClient } from '@/services/api/vaultClient';

let activeClient: VaultClient = defaultVaultClient;

/**
 * Dependency injection hook for test environments and alternative client bindings.
 */
export function setVaultClient(client: VaultClient): void {
	activeClient = client;
}

export function getVaultClient(): VaultClient {
	return activeClient;
}

export const useVaultStore = defineStore('vault', () => {
	// State
	// Status starts as a locked placeholder but is gated by isInitializing
	const status = ref<VaultStatus>({ state: 'locked' });
	const isInitializing = ref(true);
	const initError = ref<string | null>(null);

	const credentials = ref<CredentialSummary[]>([]);
	const passwords = ref<CredentialSummary[]>([]);
	const apiKeys = ref<CredentialSummary[]>([]);
	const selectedCredential = ref<CredentialDetail | null>(null);
	const activity = ref<ActivityEvent[]>([]);
	const notifications = ref<AppNotification[]>([]);
	const filters = ref<CredentialFilters>({
		search: '',
		kind: 'all',
		category: 'All',
		sortBy: 'updatedAt',
		sortOrder: 'desc',
	});
	const isLoading = ref(false);
	const error = ref<string | null>(null);
	const isCreating = ref(false);
	const isUnlocking = ref(false);
	const isRecovering = ref(false);
	const isLocking = ref(false);
	const lockError = ref<string | null>(null);
	const isReconciling = ref(false);
	const reconciliationError = ref<string | null>(null);
	const recoveryKeyPresented = ref<string | null>(null);
	const currentPage = ref<PageId>('overview');
	// Global, centralized credential-creation modal. Any surface (sidebar,
	// overview, a credential list) can request it without navigating away.
	const createModalOpen = ref(false);

	let pendingInitPromise: Promise<void> | null = null;

	// Computed — strictly gated on confirmed backend status without connection errors
	const isUnlocked = computed(
		() => !isInitializing.value && !initError.value && status.value.state === 'unlocked',
	);
	const isUninitialized = computed(
		() => !isInitializing.value && !initError.value && status.value.state === 'uninitialized',
	);
	const isLocked = computed(
		() => !isInitializing.value && !initError.value && status.value.state === 'locked',
	);

	function applyFilters(items: CredentialSummary[]): CredentialSummary[] {
		return items
			.filter((c) => {
				if (filters.value.kind !== 'all' && c.kind !== filters.value.kind) return false;
				if (filters.value.category !== 'All' && c.category !== filters.value.category) return false;
				if (filters.value.search) {
					const q = filters.value.search.toLowerCase();
					return (
						c.title.toLowerCase().includes(q) ||
						c.username?.toLowerCase().includes(q) ||
						c.category?.toLowerCase().includes(q) ||
						c.tags.some((t) => t.toLowerCase().includes(q))
					);
				}
				return true;
			})
			.sort((a, b) => {
				const key = filters.value.sortBy;
				const aVal = String(a[key] ?? '');
				const bVal = String(b[key] ?? '');
				const cmp = aVal.localeCompare(bVal);
				return filters.value.sortOrder === 'asc' ? cmp : -cmp;
			});
	}

	const filteredPasswords = computed(() => applyFilters(passwords.value));
	const filteredApiKeys = computed(() => applyFilters(apiKeys.value));

	// Actions
	function notify(notification: Omit<AppNotification, 'id'>) {
		const id = crypto.randomUUID ? crypto.randomUUID() : `notif-${Date.now()}`;
		const full: AppNotification = { ...notification, id };
		notifications.value.push(full);
		const duration = notification.duration ?? 4000;
		if (duration > 0) {
			setTimeout(() => dismissNotification(id), duration);
		}
	}

	function dismissNotification(id: string) {
		notifications.value = notifications.value.filter((n) => n.id !== id);
	}

	async function init(): Promise<void> {
		if (pendingInitPromise) {
			return pendingInitPromise;
		}

		isInitializing.value = true;
		initError.value = null;
		error.value = null;
		reconciliationError.value = null;

		pendingInitPromise = (async () => {
			try {
				// No explicit session handoff here: the real vault client owns the
				// handoff lifecycle and guarantees `store.init()` (App startup)
				// begins with a valid HttpOnly session cookie before its first
				// status query. Injected test/mock clients are unaffected.
				const s = await activeClient.getVaultStatus();
				status.value = s;
			} catch {
				initError.value =
					'Failed to connect to the backend vault service. Please verify that the backend is running.';
			} finally {
				isInitializing.value = false;
				pendingInitPromise = null;
			}
		})();

		return pendingInitPromise;
	}

	/**
	 * Reconciles authoritative vault status from the backend service.
	 * Separates status synchronization from raw authentication execution.
	 */
	async function reconcileStatus(): Promise<boolean> {
		isReconciling.value = true;
		reconciliationError.value = null;
		try {
			const s = await activeClient.getVaultStatus();
			status.value = s;
			return true;
		} catch {
			reconciliationError.value =
				'Authentication succeeded, but client failed to confirm updated session status from backend. Click below to retry synchronization.';
			return false;
		} finally {
			isReconciling.value = false;
		}
	}

	async function setupVault(passphrase: string, confirm: string): Promise<CreateVaultResult> {
		if (isInitializing.value || !isUninitialized.value) {
			return { success: false, error: 'Vault is not ready for initialization.' };
		}
		isCreating.value = true;
		error.value = null;
		reconciliationError.value = null;
		try {
			const result = await activeClient.createVault(passphrase, confirm);
			if (result.success) {
				if (result.recoveryKey) {
					// Store in reactive memory for the presentation step; never persisted
					recoveryKeyPresented.value = result.recoveryKey;
				} else {
					// If backend did not supply a recovery key, complete directly
					await completeSetup();
				}
				return result;
			} else {
				error.value = result.error ?? 'Failed to initialize vault';
				return result;
			}
		} catch {
			error.value = 'An error occurred during vault creation';
			return { success: false, error: 'An error occurred during vault creation' };
		} finally {
			isCreating.value = false;
		}
	}

	async function completeSetup(): Promise<boolean> {
		error.value = null;
		try {
			const s = await activeClient.getVaultStatus();
			status.value = s;
			// ONLY clear the presented recovery key once the transition to unlocked status is confirmed!
			recoveryKeyPresented.value = null;
			notify({ type: 'success', title: 'Vault created and unlocked' });
			return true;
		} catch {
			// Retain recoveryKeyPresented so the user does NOT lose their key if status fetch fails!
			error.value =
				'Vault was created, but failed to confirm updated status. Your recovery key is retained above. Please retry completing setup.';
			notify({
				type: 'warning',
				title: 'Status Confirmation Failed',
				message: 'Could not confirm vault status. Your recovery key is retained. Please retry.',
			});
			return false;
		}
	}

	function cancelSetup() {
		recoveryKeyPresented.value = null;
		error.value = null;
		reconciliationError.value = null;
	}

	async function unlock(passphrase: string): Promise<boolean> {
		if (isInitializing.value || !isLocked.value) {
			return false;
		}
		isUnlocking.value = true;
		error.value = null;
		reconciliationError.value = null;

		let authSuccess = false;
		try {
			const result = await activeClient.unlockVault(passphrase);
			if (result.success) {
				authSuccess = true;
			} else {
				error.value = result.error ?? 'Invalid passphrase';
				return false;
			}
		} catch {
			error.value = 'Failed to execute unlock operation';
			return false;
		} finally {
			isUnlocking.value = false;
		}

		if (authSuccess) {
			// Distinguish authentication success from status synchronization
			const reconciled = await reconcileStatus();
			if (reconciled) {
				notify({ type: 'success', title: 'Vault unlocked' });
				return true;
			} else {
				notify({
					type: 'warning',
					title: 'Session Unsynchronized',
					message: 'Vault was unlocked on backend, but status could not be synchronized.',
				});
				return false;
			}
		}
		return false;
	}

	async function recover(recoveryKey: string): Promise<boolean> {
		if (isInitializing.value || !isLocked.value) {
			return false;
		}
		isRecovering.value = true;
		error.value = null;
		reconciliationError.value = null;

		let authSuccess = false;
		try {
			if (typeof activeClient.recoverVault !== 'function') {
				error.value = 'Emergency recovery is not supported by the active backend.';
				return false;
			}
			const result = await activeClient.recoverVault(recoveryKey);
			if (result.success) {
				authSuccess = true;
			} else {
				error.value = result.error ?? 'Invalid recovery key';
				return false;
			}
		} catch {
			error.value = 'Failed to execute recovery operation';
			return false;
		} finally {
			isRecovering.value = false;
		}

		if (authSuccess) {
			// Distinguish authentication success from status synchronization
			const reconciled = await reconcileStatus();
			if (reconciled) {
				notify({ type: 'success', title: 'Vault recovered successfully' });
				return true;
			} else {
				notify({
					type: 'warning',
					title: 'Session Unsynchronized',
					message: 'Vault was recovered on backend, but status could not be synchronized.',
				});
				return false;
			}
		}
		return false;
	}

	async function lock(): Promise<boolean> {
		// Concurrency guard: ignore duplicate simultaneous lock requests
		if (isLocking.value) {
			return false;
		}

		isLocking.value = true;
		lockError.value = null;
		reconciliationError.value = null;

		// Immediate reactive state hygiene: scrub cached credentials and keys from frontend memory
		credentials.value = [];
		passwords.value = [];
		apiKeys.value = [];
		selectedCredential.value = null;
		activity.value = [];
		recoveryKeyPresented.value = null;
		currentPage.value = 'overview';
		createModalOpen.value = false;

		try {
			await activeClient.lockVault();
			// Only set status to locked after backend confirms session disposal
			status.value = { state: 'locked' };
			notify({ type: 'info', title: 'Vault locked' });
			return true;
		} catch {
			lockError.value =
				'Backend failed to terminate vault session. Sensitive frontend state was purged, but backend lock could not be confirmed.';
			notify({
				type: 'error',
				title: 'Lock Unconfirmed',
				message: 'Backend session could not be terminated. Please retry.',
			});
			return false;
		} finally {
			isLocking.value = false;
		}
	}

	async function retryLock(): Promise<boolean> {
		return lock();
	}

	async function loadAll() {
		isLoading.value = true;
		try {
			const [creds, pwds, keys] = await Promise.all([
				activeClient.listCredentials(),
				activeClient.listPasswords(),
				activeClient.listApiKeys(),
			]);
			credentials.value = creds;
			passwords.value = pwds;
			apiKeys.value = keys;
		} catch {
			error.value = 'Failed to load credentials';
		} finally {
			isLoading.value = false;
		}
	}

	async function loadActivity() {
		try {
			activity.value = await activeClient.getActivity();
		} catch {
			/* non-critical */
		}
	}

	async function selectCredential(id: string | null) {
		if (!id) {
			selectedCredential.value = null;
			return;
		}
		try {
			selectedCredential.value = await activeClient.getCredential(id);
		} catch {
			notify({ type: 'error', title: 'Failed to load credential' });
		}
	}

	async function createCredential(input: CreateCredentialInput): Promise<CredentialSummary> {
		isCreating.value = true;
		try {
			const summary = await activeClient.createCredential(input);
			credentials.value = [summary, ...credentials.value];
			if (input.kind === 'api-key' || input.kind === 'access-token') {
				apiKeys.value = [summary, ...apiKeys.value];
			} else if (input.kind === 'password') {
				passwords.value = [summary, ...passwords.value];
			}
			notify({ type: 'success', title: 'Credential created' });
			return summary;
		} catch {
			notify({ type: 'error', title: 'Failed to create credential' });
			throw new Error('Failed');
		} finally {
			isCreating.value = false;
		}
	}

	async function updateCredential(
		id: string,
		input: UpdateCredentialInput,
	): Promise<CredentialSummary> {
		try {
			const summary = await activeClient.updateCredential(id, input);
			credentials.value = credentials.value.map((c) => (c.id === id ? summary : c));
			passwords.value = passwords.value.map((c) => (c.id === id ? summary : c));
			apiKeys.value = apiKeys.value.map((c) => (c.id === id ? summary : c));
			if (selectedCredential.value?.id === id) {
				selectedCredential.value = { ...selectedCredential.value, ...summary } as CredentialDetail;
			}
			notify({ type: 'success', title: 'Credential updated' });
			return summary;
		} catch {
			notify({ type: 'error', title: 'Failed to update credential' });
			throw new Error('Failed');
		}
	}

	async function deleteCredential(id: string) {
		try {
			await activeClient.deleteCredential(id);
			credentials.value = credentials.value.filter((c) => c.id !== id);
			passwords.value = passwords.value.filter((c) => c.id !== id);
			apiKeys.value = apiKeys.value.filter((c) => c.id !== id);
			if (selectedCredential.value?.id === id) selectedCredential.value = null;
			notify({ type: 'success', title: 'Credential deleted' });
		} catch {
			notify({ type: 'error', title: 'Failed to delete credential' });
			throw new Error('Failed');
		}
	}

	function setFilters(partial: Partial<CredentialFilters>) {
		filters.value = { ...filters.value, ...partial };
	}

	function navigate(page: PageId) {
		// Section changes must not leave a credential from the previous section
		// rendered in the detail workspace: clear the active selection so the
		// list and the detail pane can never disagree (design spec §6 / D2).
		selectedCredential.value = null;
		currentPage.value = page;
	}

	function openCreateModal() {
		createModalOpen.value = true;
	}

	function closeCreateModal() {
		createModalOpen.value = false;
	}

	return {
		status,
		isInitializing,
		initError,
		credentials,
		passwords,
		apiKeys,
		selectedCredential,
		activity,
		notifications,
		filters,
		isLoading,
		error,
		isCreating,
		isUnlocking,
		isRecovering,
		isLocking,
		lockError,
		isReconciling,
		reconciliationError,
		recoveryKeyPresented,
		currentPage,
		createModalOpen,
		isUnlocked,
		isUninitialized,
		isLocked,
		filteredPasswords,
		filteredApiKeys,
		notify,
		dismissNotification,
		init,
		reconcileStatus,
		setupVault,
		completeSetup,
		cancelSetup,
		unlock,
		recover,
		lock,
		retryLock,
		loadAll,
		loadActivity,
		selectCredential,
		createCredential,
		updateCredential,
		deleteCredential,
		setFilters,
		navigate,
		openCreateModal,
		closeCreateModal,
	};
});
