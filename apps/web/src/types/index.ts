// Aegis Type Definitions

import type { OAuth2Metadata as ContractOAuth2Metadata } from '@aegis/contracts';

export type CredentialKind =
	| 'password'
	| 'api-key'
	| 'access-token'
	| 'ssh-key'
	| 'oauth2'
	| 'secure-note';

export interface CredentialSummary {
	id: string;
	vaultId: string;
	kind: CredentialKind;
	title: string;
	username?: string | undefined;
	url?: string | undefined;
	category?: string | undefined;
	tags: string[];
	createdAt: string;
	updatedAt: string;
}

// API Key specific metadata
export interface ApiKeyMetadata {
	provider?: string | undefined;
	project?: string | undefined;
	environment?: 'production' | 'staging' | 'development' | 'test' | undefined;
	expiresAt?: string | undefined;
	lastUsed?: string | undefined;
	scopes?: string[] | undefined;
}

// OAuth2 credential storage metadata (storage model, without OAuth flow execution)
export type OAuth2Metadata = ContractOAuth2Metadata;

// SSH Key specific metadata
export interface SshKeyMetadata {
	keyType?: 'ed25519' | 'rsa' | 'ecdsa' | undefined;
	fingerprint?: string | undefined;
	passphraseProtected?: boolean | undefined;
	publicKey?: string | undefined;
}

// Secure Note specific metadata
export interface SecureNoteMetadata {
	format?: 'plain' | 'markdown' | undefined;
	isSensitive?: boolean | undefined;
	characterCount?: number | undefined;
}

export interface CredentialDetail extends CredentialSummary {
	secret: string;
	notes?: string | undefined;
	metadata?: ApiKeyMetadata | undefined;
	apiKeyMetadata?: ApiKeyMetadata | undefined;
	oauth2Metadata?: OAuth2Metadata | undefined;
	sshKeyMetadata?: SshKeyMetadata | undefined;
	secureNoteMetadata?: SecureNoteMetadata | undefined;
}

export interface ApiKeyDetail extends CredentialDetail {
	kind: 'api-key' | 'access-token';
	metadata?: ApiKeyMetadata | undefined;
	apiKeyMetadata?: ApiKeyMetadata | undefined;
}

export interface OAuth2Detail extends CredentialDetail {
	kind: 'oauth2';
	oauth2Metadata?: OAuth2Metadata | undefined;
}

export interface SshKeyDetail extends CredentialDetail {
	kind: 'ssh-key';
	sshKeyMetadata?: SshKeyMetadata | undefined;
}

export interface SecureNoteDetail extends CredentialDetail {
	kind: 'secure-note';
	secureNoteMetadata?: SecureNoteMetadata | undefined;
}

export interface CreateCredentialInput {
	kind: CredentialKind;
	title: string;
	username?: string | undefined;
	secret: string;
	url?: string | undefined;
	category?: string | undefined;
	tags?: string[] | undefined;
	notes?: string | undefined;
	metadata?: ApiKeyMetadata | undefined;
	apiKeyMetadata?: ApiKeyMetadata | undefined;
	oauth2Metadata?: OAuth2Metadata | undefined;
	sshKeyMetadata?: SshKeyMetadata | undefined;
	secureNoteMetadata?: SecureNoteMetadata | undefined;
}

export interface UpdateCredentialInput {
	title?: string | undefined;
	username?: string | undefined;
	secret?: string | undefined;
	url?: string | undefined;
	category?: string | undefined;
	tags?: string[] | undefined;
	notes?: string | undefined;
	metadata?: ApiKeyMetadata | undefined;
	apiKeyMetadata?: ApiKeyMetadata | undefined;
	oauth2Metadata?: OAuth2Metadata | undefined;
	sshKeyMetadata?: SshKeyMetadata | undefined;
	secureNoteMetadata?: SecureNoteMetadata | undefined;
}

export type VaultState = 'uninitialized' | 'locked' | 'unlocked';

export interface VaultStatus {
	state: VaultState;
	vaultId?: string | undefined;
	credentialCount?: number | undefined;
	passwordCount?: number | undefined;
	apiKeyCount?: number | undefined;
	tokenCount?: number | undefined;
	sshKeyCount?: number | undefined;
	oauth2Count?: number | undefined;
	secureNoteCount?: number | undefined;
	lastUnlockedAt?: string | undefined;
	sessionExpiresAt?: string | undefined;
}

export interface ActivityEvent {
	id: string;
	type:
		| 'credential_created'
		| 'credential_updated'
		| 'credential_deleted'
		| 'credential_accessed'
		| 'vault_locked'
		| 'vault_unlocked';
	title: string;
	detail?: string | undefined;
	timestamp: string;
	credentialKind?: CredentialKind | undefined;
}

export interface AppNotification {
	id: string;
	type: 'success' | 'error' | 'warning' | 'info';
	title: string;
	message?: string;
	duration?: number;
}

export interface CredentialFilters {
	search: string;
	kind: CredentialKind | 'all';
	category: string;
	sortBy: 'title' | 'updatedAt' | 'createdAt';
	sortOrder: 'asc' | 'desc';
}

export type ThemeMode = 'light' | 'dark';

export type PageId =
	| 'overview'
	| 'passwords'
	| 'api-keys'
	| 'ssh-keys'
	| 'oauth2'
	| 'secure-notes'
	| 'security'
	| 'settings';

/**
 * Non-application route surfaced for Phase 1 review only: the design-system
 * showcase is mounted when the URL hash equals `#/design-system`. It is not
 * part of the vault navigation model (PageId) and never renders app data.
 */
export const DESIGN_SYSTEM_HASH = '#/design-system';

export function isDesignSystemRoute(hash: string): boolean {
	return hash === DESIGN_SYSTEM_HASH;
}
