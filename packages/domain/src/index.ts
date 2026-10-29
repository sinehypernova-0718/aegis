export const packageName = '@aegis/domain' as const;

// --- Errors -----------------------------------------------------------------
export {
	CredentialDecryptionError,
	CredentialNotFoundError,
	DomainError,
	InvalidCredentialPayloadError,
	InvalidCursorError,
	InvalidKeyEnvelopeError,
	InvalidPaginationError,
	InvalidVaultInputError,
	PersistenceError,
	SessionRegistrationConflictError,
	UnlockRejectedError,
	UnsupportedEncryptionFormatError,
	VaultAlreadyInitializedError,
	VaultAlreadyUnlockedError,
	VaultLockedError,
	VaultNotFoundError,
} from './errors/domain-errors.js';

// --- Ports ------------------------------------------------------------------
export type { Clock, IdGenerator, Scheduler } from './ports/runtime.js';
export type {
	NewPersistedKeyEnvelope,
	NewVaultState,
	PersistedKeyEnvelope,
	VaultRepositoryPort,
	VaultState,
} from './ports/vault-repository.js';
export type {
	CredentialListOptions,
	CredentialRecordRow,
	CredentialRepositoryPort,
	NewCredentialRecordRow,
} from './ports/credential-repository.js';
export type {
	CreateVaultSessionRequest,
	UnlockVaultSessionRequest,
	VaultCryptoPort,
} from './ports/vault-crypto.js';

// --- Credentials ------------------------------------------------------------
export { CREDENTIAL_KINDS, ENCRYPTED_RECORD_TYPE } from './credentials/credential-kind.js';
export type { CredentialKind } from './credentials/credential-kind.js';
export {
	CREDENTIAL_MAX_TAGS,
	CREDENTIAL_NAME_MAX_LENGTH,
	CREDENTIAL_NOTES_MAX_LENGTH,
	CREDENTIAL_PAYLOAD_SCHEMA_VERSION,
	CREDENTIAL_SECRET_MAX_LENGTH,
	CREDENTIAL_TAG_MAX_LENGTH,
	CREDENTIAL_URL_MAX_LENGTH,
	CREDENTIAL_USERNAME_MAX_LENGTH,
	CredentialPayloadSchema,
	parseCredentialPayload,
	serializeCredentialPayload,
	validateCredentialPayload,
} from './credentials/credential-payload.js';
export type {
	CredentialPayload,
	CredentialPayloadInput,
} from './credentials/credential-payload.js';
export {
	CURSOR_DECODED_MAX_BYTES,
	decodeCredentialCursor,
	encodeCredentialCursor,
} from './credentials/credential-cursor.js';
export type { CredentialCursor } from './credentials/credential-cursor.js';

// --- Sessions ---------------------------------------------------------------
export { DefaultVaultSessionManager } from './sessions/vault-session-manager.js';
export type {
	VaultSessionManager,
	VaultSessionManagerOptions,
} from './sessions/vault-session-manager.js';
export { DEFAULT_VAULT_IDLE_TIMEOUT_MS, systemScheduler } from './sessions/scheduler.js';

// --- Vault use cases --------------------------------------------------------
export { InitializeVault } from './use-cases/vault/initialize-vault.js';
export type {
	InitializeVaultDeps,
	InitializeVaultInput,
	InitializeVaultResult,
} from './use-cases/vault/initialize-vault.js';
export { UnlockVault } from './use-cases/vault/unlock-vault.js';
export type {
	UnlockVaultDeps,
	UnlockVaultInput,
	UnlockVaultResult,
} from './use-cases/vault/unlock-vault.js';
export { LockVault } from './use-cases/vault/lock-vault.js';
export type {
	LockVaultDeps,
	LockVaultInput,
	LockVaultResult,
} from './use-cases/vault/lock-vault.js';
export { GetVaultStatus } from './use-cases/vault/get-vault-status.js';
export type {
	GetVaultStatusDeps,
	GetVaultStatusInput,
	GetVaultStatusResult,
	VaultStatus,
} from './use-cases/vault/get-vault-status.js';

// --- Credential use cases ---------------------------------------------------
export { CreateCredential } from './use-cases/credentials/create-credential.js';
export type {
	CreateCredentialDeps,
	CreateCredentialInput,
} from './use-cases/credentials/create-credential.js';
export { GetCredential } from './use-cases/credentials/get-credential.js';
export type {
	GetCredentialDeps,
	GetCredentialInput,
} from './use-cases/credentials/get-credential.js';
export { ListCredentials } from './use-cases/credentials/list-credentials.js';
export type {
	ListCredentialsDeps,
	ListCredentialsInput,
	ListCredentialsResult,
} from './use-cases/credentials/list-credentials.js';
export { UpdateCredential } from './use-cases/credentials/update-credential.js';
export type {
	UpdateCredentialDeps,
	UpdateCredentialInput,
	UpdateCredentialResult,
} from './use-cases/credentials/update-credential.js';
export { DeleteCredential } from './use-cases/credentials/delete-credential.js';
export type {
	DeleteCredentialDeps,
	DeleteCredentialInput,
	DeleteCredentialResult,
} from './use-cases/credentials/delete-credential.js';
export type { CredentialView } from './use-cases/credentials/credential-view.js';
