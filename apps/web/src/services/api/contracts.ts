// Service contracts — typed interface for vault operations

import type { CredentialCounts } from '@aegis/contracts';
import type {
	ActivityEvent,
	CreateCredentialInput,
	CredentialDetail,
	CredentialKind,
	CredentialSummary,
	UpdateCredentialInput,
	VaultStatus,
} from '@/types';

export interface CreateVaultResult {
	success: boolean;
	error?: string;
	/**
	 * Recovery key issued by the backend exactly once at vault creation.
	 * The backend always returns one; the store presents it before setup
	 * completes and it is never persisted client-side.
	 */
	recoveryKey?: string;
}

export interface RecoverVaultResult {
	success: boolean;
	error?: string;
}

export interface VaultClient {
	getVaultStatus(): Promise<VaultStatus>;
	getCredentialCounts?(): Promise<CredentialCounts>;
	unlockVault(passphrase: string): Promise<{ success: boolean; error?: string }>;
	createVault(passphrase: string, confirmPassphrase: string): Promise<CreateVaultResult>;
	/**
	 * Emergency recovery: unlock with the recovery key issued at vault
	 * creation. Optional only so injected test/mock clients can omit it —
	 * the real backend implements the `POST /vaults/:id/recover` route.
	 */
	recoverVault?(recoveryKey: string): Promise<RecoverVaultResult>;
	lockVault(): Promise<void>;
	listCredentials(filter?: {
		kind?: CredentialKind;
		category?: string;
	}): Promise<CredentialSummary[]>;
	listCredentialPage?(cursor?: string): Promise<{
		items: CredentialSummary[];
		nextCursor: string | null;
	}>;
	listPasswords(): Promise<CredentialSummary[]>;
	listApiKeys(): Promise<CredentialSummary[]>;
	listOAuth2Credentials?(): Promise<CredentialSummary[]>;
	listSecureNotes?(): Promise<CredentialSummary[]>;
	getCredential(id: string): Promise<CredentialDetail>;
	createCredential(input: CreateCredentialInput): Promise<CredentialSummary>;
	updateCredential(id: string, input: UpdateCredentialInput): Promise<CredentialSummary>;
	deleteCredential(id: string): Promise<void>;
	getActivity(): Promise<ActivityEvent[]>;
	isUnlocked(): boolean;
}

export const CREDENTIAL_KINDS: { value: CredentialKind; label: string }[] = [
	{ value: 'password', label: 'Password' },
	{ value: 'api-key', label: 'API Key' },
	{ value: 'access-token', label: 'Access Token' },
	{ value: 'ssh-key', label: 'SSH Key' },
	{ value: 'oauth2', label: 'OAuth2' },
	{ value: 'secure-note', label: 'Secure Note' },
];

export const CATEGORIES = [
	'All',
	'Development',
	'Infrastructure',
	'Payments',
	'Communications',
	'Operations',
	'AI Services',
	'Security',
	'Personal',
];
