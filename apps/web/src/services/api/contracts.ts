// Service contracts — typed interface for vault operations

import type {
	CredentialKind,
	CredentialSummary,
	CredentialDetail,
	CreateCredentialInput,
	UpdateCredentialInput,
	VaultStatus,
	ActivityEvent,
} from '@/types';

export interface CreateVaultResult {
	success: boolean;
	error?: string;
	/**
	 * Optional recovery key returned by the backend upon vault creation.
	 * If omitted by the backend, the frontend does not fabricate one.
	 */
	recoveryKey?: string;
}

export interface RecoverVaultResult {
	success: boolean;
	error?: string;
}

export interface VaultClient {
	getVaultStatus(): Promise<VaultStatus>;
	unlockVault(passphrase: string): Promise<{ success: boolean; error?: string }>;
	createVault(passphrase: string, confirmPassphrase: string): Promise<CreateVaultResult>;
	/**
	 * Emergency recovery integration boundary.
	 * Defined as an optional method when backed by recovery-capable backends.
	 */
	recoverVault?(recoveryKey: string): Promise<RecoverVaultResult>;
	lockVault(): Promise<void>;
	listCredentials(filter?: {
		kind?: CredentialKind;
		category?: string;
	}): Promise<CredentialSummary[]>;
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
