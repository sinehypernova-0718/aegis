// Mock Vault Client — development-only adapter

import type { VaultClient, CreateVaultResult, RecoverVaultResult } from '@/services/api/contracts';
import type {
	CredentialKind,
	CredentialSummary,
	CredentialDetail,
	CreateCredentialInput,
	UpdateCredentialInput,
	VaultStatus,
	VaultState,
	ActivityEvent,
	ApiKeyDetail,
} from '@/types';
import { SYNTHETIC_CREDENTIALS, SYNTHETIC_API_KEYS, SYNTHETIC_ACTIVITY } from './fixtures';

const MOCK_DELAY = 300;

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateId(): string {
	return typeof crypto !== 'undefined' && crypto.randomUUID
		? crypto.randomUUID()
		: `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toSummary(item: CredentialDetail): CredentialSummary {
	return {
		id: item.id,
		vaultId: item.vaultId,
		kind: item.kind,
		title: item.title,
		username: item.username,
		url: item.url,
		category: item.category,
		tags: [...item.tags],
		createdAt: item.createdAt,
		updatedAt: item.updatedAt,
	};
}

let credentials: CredentialDetail[] = [...SYNTHETIC_CREDENTIALS];
let apiKeys: ApiKeyDetail[] = [...SYNTHETIC_API_KEYS];
let activities: ActivityEvent[] = [...SYNTHETIC_ACTIVITY];
let isInitialized = false;
let isUnlocked = false;
let unlockedAt: string | null = null;

/**
 * Development testing utility: allows explicit mock vault state switching
 * to verify uninitialized setup, locked unlock, and recovery flows.
 */
export function setMockVaultState(state: VaultState): void {
	if (state === 'uninitialized') {
		isInitialized = false;
		isUnlocked = false;
		unlockedAt = null;
	} else if (state === 'locked') {
		isInitialized = true;
		isUnlocked = false;
		unlockedAt = null;
	} else if (state === 'unlocked') {
		isInitialized = true;
		isUnlocked = true;
		unlockedAt = new Date().toISOString();
	}
}

/**
 * Reset mock fixtures and state back to fresh synthetic data baseline.
 */
export function resetMockVaultClient(): void {
	credentials = [...SYNTHETIC_CREDENTIALS];
	apiKeys = [...SYNTHETIC_API_KEYS];
	activities = [...SYNTHETIC_ACTIVITY];
	isInitialized = false;
	isUnlocked = false;
	unlockedAt = null;
}

export const mockVaultClient: VaultClient = {
	async getVaultStatus(): Promise<VaultStatus> {
		await delay(MOCK_DELAY);
		const allItems: CredentialDetail[] = [...credentials, ...apiKeys];
		const totalCount = allItems.length;

		if (!isInitialized) {
			return {
				state: 'uninitialized',
			};
		}

		const counts = {
			passwordCount: allItems.filter((c) => c.kind === 'password').length,
			apiKeyCount: allItems.filter((c) => c.kind === 'api-key' || c.kind === 'access-token').length,
			tokenCount: allItems.filter((c) => c.kind === 'access-token').length,
			sshKeyCount: allItems.filter((c) => c.kind === 'ssh-key').length,
			oauth2Count: allItems.filter((c) => c.kind === 'oauth2').length,
			secureNoteCount: allItems.filter((c) => c.kind === 'secure-note').length,
		};

		if (!isUnlocked) {
			return {
				state: 'locked',
				vaultId: 'vault-main',
				credentialCount: totalCount,
				...counts,
			};
		}

		return {
			state: 'unlocked',
			vaultId: 'vault-main',
			credentialCount: totalCount,
			...counts,
			lastUnlockedAt: unlockedAt ?? undefined,
			sessionExpiresAt: unlockedAt
				? new Date(new Date(unlockedAt).getTime() + 15 * 60 * 1000).toISOString()
				: undefined,
		};
	},

	async unlockVault(passphrase: string): Promise<{ success: boolean; error?: string }> {
		await delay(600);
		if (!passphrase || passphrase.length < 1) {
			return { success: false, error: 'Passphrase is required.' };
		}
		if (passphrase.length < 8) {
			return { success: false, error: 'Incorrect master passphrase. Please try again.' };
		}
		isUnlocked = true;
		unlockedAt = new Date().toISOString();
		return { success: true };
	},

	async createVault(passphrase: string, confirm: string): Promise<CreateVaultResult> {
		await delay(800);
		if (!passphrase || passphrase.length < 12) {
			return { success: false, error: 'Passphrase must be at least 12 characters.' };
		}
		if (passphrase !== confirm) {
			return { success: false, error: 'Passphrases do not match.' };
		}
		isInitialized = true;
		isUnlocked = true;
		unlockedAt = new Date().toISOString();
		return {
			success: true,
			recoveryKey: 'AEGIS-RCV-9B4F-28A1-7CE0-D532',
		};
	},

	async recoverVault(recoveryKey: string): Promise<RecoverVaultResult> {
		await delay(700);
		const cleaned = recoveryKey.trim().toUpperCase();
		if (!cleaned) {
			return { success: false, error: 'Recovery key cannot be empty.' };
		}
		if (!cleaned.startsWith('AEGIS-') || cleaned.length < 16) {
			return { success: false, error: 'Invalid recovery key format. Expected AEGIS-XXXX-XXXX-...' };
		}
		isInitialized = true;
		isUnlocked = true;
		unlockedAt = new Date().toISOString();
		return { success: true };
	},

	async lockVault(): Promise<void> {
		await delay(100);
		isUnlocked = false;
		unlockedAt = null;
	},

	async listCredentials(filter?: {
		kind?: CredentialKind;
		category?: string;
	}): Promise<CredentialSummary[]> {
		await delay(MOCK_DELAY);
		if (!isUnlocked) throw new Error('Vault is locked');
		let allItems: CredentialDetail[] = [...credentials, ...apiKeys];
		if (filter?.kind) {
			allItems = allItems.filter((c) => c.kind === filter.kind);
		}
		if (filter?.category && filter.category !== 'All') {
			allItems = allItems.filter((c) => c.category === filter.category);
		}
		return allItems.map(toSummary);
	},

	async listPasswords(): Promise<CredentialSummary[]> {
		await delay(MOCK_DELAY);
		if (!isUnlocked) throw new Error('Vault is locked');
		return credentials.filter((c) => c.kind === 'password').map(toSummary);
	},

	async listApiKeys(): Promise<CredentialSummary[]> {
		await delay(MOCK_DELAY);
		if (!isUnlocked) throw new Error('Vault is locked');
		return apiKeys.map(toSummary);
	},

	async listOAuth2Credentials(): Promise<CredentialSummary[]> {
		await delay(MOCK_DELAY);
		if (!isUnlocked) throw new Error('Vault is locked');
		return credentials.filter((c) => c.kind === 'oauth2').map(toSummary);
	},

	async listSecureNotes(): Promise<CredentialSummary[]> {
		await delay(MOCK_DELAY);
		if (!isUnlocked) throw new Error('Vault is locked');
		return credentials.filter((c) => c.kind === 'secure-note').map(toSummary);
	},

	async getCredential(id: string): Promise<CredentialDetail> {
		await delay(MOCK_DELAY);
		if (!isUnlocked) throw new Error('Vault is locked');
		const cred = [...credentials, ...apiKeys].find((c) => c.id === id);
		if (!cred) throw new Error('Credential not found');
		return { ...cred };
	},

	async createCredential(input: CreateCredentialInput): Promise<CredentialSummary> {
		await delay(MOCK_DELAY);
		if (!isUnlocked) throw new Error('Vault is locked');
		const now = new Date().toISOString();
		const newCred: CredentialDetail = {
			id: generateId(),
			vaultId: 'vault-main',
			kind: input.kind,
			title: input.title,
			username: input.username,
			url: input.url,
			category: input.category,
			tags: input.tags ? [...input.tags] : [],
			secret: input.secret,
			notes: input.notes,
			createdAt: now,
			updatedAt: now,
			metadata: input.metadata ?? input.apiKeyMetadata,
			apiKeyMetadata: input.apiKeyMetadata ?? input.metadata,
			oauth2Metadata: input.oauth2Metadata ? { ...input.oauth2Metadata } : undefined,
			sshKeyMetadata: input.sshKeyMetadata ? { ...input.sshKeyMetadata } : undefined,
			secureNoteMetadata: input.secureNoteMetadata ? { ...input.secureNoteMetadata } : undefined,
		};

		if (input.kind === 'api-key' || input.kind === 'access-token') {
			const apiKey: ApiKeyDetail = {
				...newCred,
				kind: input.kind,
				metadata: newCred.apiKeyMetadata,
				apiKeyMetadata: newCred.apiKeyMetadata,
			};
			apiKeys = [apiKey, ...apiKeys];
		} else {
			credentials = [newCred, ...credentials];
		}

		const event: ActivityEvent = {
			id: generateId(),
			type: 'credential_created',
			title: `${newCred.title} added`,
			detail: `New ${input.kind} credential entry`,
			timestamp: now,
			credentialKind: input.kind,
		};
		activities = [event, ...activities];

		return toSummary(newCred);
	},

	async updateCredential(id: string, input: UpdateCredentialInput): Promise<CredentialSummary> {
		await delay(MOCK_DELAY);
		if (!isUnlocked) throw new Error('Vault is locked');

		const credIdx = credentials.findIndex((c) => c.id === id);
		const keyIdx = apiKeys.findIndex((k) => k.id === id);

		if (credIdx === -1 && keyIdx === -1) throw new Error('Credential not found');

		const isApiKey = keyIdx !== -1;
		const existing: CredentialDetail | ApiKeyDetail | undefined = isApiKey
			? apiKeys[keyIdx]
			: credentials[credIdx];
		if (existing === undefined) throw new Error('Credential not found');
		const now = new Date().toISOString();

		const updated: CredentialDetail = {
			...existing,
			...(input.title !== undefined ? { title: input.title } : {}),
			...(input.username !== undefined ? { username: input.username } : {}),
			...(input.secret !== undefined ? { secret: input.secret } : {}),
			...(input.url !== undefined ? { url: input.url } : {}),
			...(input.category !== undefined ? { category: input.category } : {}),
			...(input.tags !== undefined ? { tags: [...input.tags] } : {}),
			...(input.notes !== undefined ? { notes: input.notes } : {}),
			...(input.metadata !== undefined || input.apiKeyMetadata !== undefined
				? {
						metadata: input.apiKeyMetadata ?? input.metadata,
						apiKeyMetadata: input.apiKeyMetadata ?? input.metadata,
					}
				: {}),
			...(input.oauth2Metadata !== undefined
				? { oauth2Metadata: { ...existing.oauth2Metadata, ...input.oauth2Metadata } }
				: {}),
			...(input.sshKeyMetadata !== undefined
				? { sshKeyMetadata: { ...existing.sshKeyMetadata, ...input.sshKeyMetadata } }
				: {}),
			...(input.secureNoteMetadata !== undefined
				? { secureNoteMetadata: { ...existing.secureNoteMetadata, ...input.secureNoteMetadata } }
				: {}),
			updatedAt: now,
		};

		if (isApiKey) {
			apiKeys[keyIdx] = {
				...updated,
				kind: existing.kind as 'api-key' | 'access-token',
				metadata: updated.apiKeyMetadata,
				apiKeyMetadata: updated.apiKeyMetadata,
			};
		} else {
			credentials[credIdx] = updated;
		}

		const event: ActivityEvent = {
			id: generateId(),
			type: 'credential_updated',
			title: `${updated.title} updated`,
			detail: 'Credential attributes modified',
			timestamp: now,
			credentialKind: updated.kind,
		};
		activities = [event, ...activities];

		return toSummary(updated);
	},

	async deleteCredential(id: string): Promise<void> {
		await delay(MOCK_DELAY);
		if (!isUnlocked) throw new Error('Vault is locked');
		const existing = [...credentials, ...apiKeys].find((c) => c.id === id);
		if (!existing) throw new Error('Credential not found');

		credentials = credentials.filter((c) => c.id !== id);
		apiKeys = apiKeys.filter((k) => k.id !== id);

		const event: ActivityEvent = {
			id: generateId(),
			type: 'credential_deleted',
			title: `${existing.title} deleted`,
			detail: `${existing.kind} removed from vault`,
			timestamp: new Date().toISOString(),
			credentialKind: existing.kind,
		};
		activities = [event, ...activities];
	},

	async getActivity(): Promise<ActivityEvent[]> {
		await delay(MOCK_DELAY);
		return [...activities];
	},

	isUnlocked(): boolean {
		return isUnlocked;
	},
};
