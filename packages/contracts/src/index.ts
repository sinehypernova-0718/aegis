export const packageName = '@aegis/contracts' as const;

// Common primitives
// Shared bounds/constants
export {
	boundedArray,
	boundedNonBlankString,
	boundedString,
	CURSOR_MAX_LENGTH,
	ENCRYPTED_PAYLOAD_MAX_BYTES,
	ENTITY_ID_MAX_LENGTH,
	ERROR_DETAIL_MAX_COUNT,
	ERROR_DETAIL_MESSAGE_MAX_LENGTH,
	ERROR_DETAIL_PATH_MAX_LENGTH,
	ERROR_MESSAGE_MAX_LENGTH,
	LABEL_MAX_LENGTH,
	LONG_TEXT_MAX_LENGTH,
	PAGINATION_DEFAULT_LIMIT,
	PAGINATION_MAX_LIMIT,
	REQUEST_ID_MAX_LENGTH,
	SHORT_TEXT_MAX_LENGTH,
	strictObject,
	TITLE_MAX_LENGTH,
} from './common/conventions.js';
export type { EntityId } from './common/ids.js';
export { EntityIdSchema } from './common/ids.js';
export type {
	PaginationQuery,
	PaginationQueryInput,
} from './common/pagination.js';
export {
	OpaqueCursorSchema,
	PaginationLimitSchema,
	PaginationLimitWithDefaultSchema,
	PaginationQuerySchema,
} from './common/pagination.js';
export {
	ClearableStringSchema,
	LabelSchema,
	LongTextSchema,
	ShortTextSchema,
	TitleSchema,
} from './common/primitives.js';
export type { IsoUtcTimestamp } from './common/timestamps.js';
export { IsoUtcTimestampSchema } from './common/timestamps.js';
export type { ContractVersion } from './common/versions.js';
export { CONTRACT_VERSION, ContractVersionSchema } from './common/versions.js';
export type {
	CreateCredentialRequest,
	CreateCredentialRequestInput,
	CreateCredentialResponse,
} from './credentials/create-credential.js';
export {
	CreateCredentialRequestSchema,
	CreateCredentialResponseSchema,
} from './credentials/create-credential.js';
export type { CredentialCounts } from './credentials/credential-counts.js';
export { CredentialCountsSchema } from './credentials/credential-counts.js';
export type { CredentialDetail } from './credentials/credential-detail.js';
export { CredentialDetailSchema } from './credentials/credential-detail.js';
export type { CredentialKind } from './credentials/credential-kind.js';
// Credentials
export { CREDENTIAL_KINDS, CredentialKindSchema } from './credentials/credential-kind.js';
export type {
	CredentialPayload,
	CredentialPayloadFields,
	CredentialPayloadInput,
	OAuth2Metadata,
} from './credentials/credential-payload.js';
export {
	CONTRACT_CREDENTIAL_KINDS,
	CREDENTIAL_MAX_TAGS,
	CREDENTIAL_NAME_MAX_LENGTH,
	CREDENTIAL_NOTES_MAX_LENGTH,
	CREDENTIAL_PAYLOAD_SCHEMA_VERSION,
	CREDENTIAL_SECRET_MAX_LENGTH,
	CREDENTIAL_TAG_MAX_LENGTH,
	CREDENTIAL_URL_MAX_LENGTH,
	CREDENTIAL_USERNAME_MAX_LENGTH,
	CredentialPayloadInputSchema,
	CredentialPayloadSchema,
} from './credentials/credential-payload.js';
export type { CredentialSummary } from './credentials/credential-summary.js';
export { CredentialSummarySchema } from './credentials/credential-summary.js';
export type { DeleteCredentialResponse } from './credentials/delete-credential.js';
export { DeleteCredentialResponseSchema } from './credentials/delete-credential.js';
export type {
	ListCredentialsQuery,
	ListCredentialsQueryInput,
	ListCredentialsResponse,
} from './credentials/list-credentials.js';
export {
	ListCredentialsQuerySchema,
	ListCredentialsResponseSchema,
} from './credentials/list-credentials.js';
export type { CredentialParams } from './credentials/params.js';
export { CredentialParamsSchema } from './credentials/params.js';
export type {
	UpdateCredentialRequest,
	UpdateCredentialRequestInput,
	UpdateCredentialResponse,
} from './credentials/update-credential.js';
export {
	UpdateCredentialRequestSchema,
	UpdateCredentialResponseSchema,
} from './credentials/update-credential.js';
export type { ErrorCode } from './errors/codes.js';
// Errors
export { ERROR_CODES, ErrorCodeSchema } from './errors/codes.js';
export type { ErrorDetail, ErrorResponse } from './errors/error-response.js';
export { ErrorDetailSchema, ErrorResponseSchema } from './errors/error-response.js';
export { SAFE_ERROR_MESSAGES, safeMessageForCode } from './errors/safe-messages.js';
export type {
	InitializeVaultRequest,
	InitializeVaultRequestInput,
	InitializeVaultResponse,
} from './vault/initialize-vault.js';
export {
	InitializeVaultRequestSchema,
	InitializeVaultResponseSchema,
	PASSPHRASE_MAX_LENGTH,
	PASSPHRASE_MIN_LENGTH,
	PassphraseSchema,
	RECOVERY_KEY_MAX_LENGTH,
	RECOVERY_KEY_MIN_LENGTH,
	RecoveryKeySchema,
	VaultRuntimeStateSchema,
} from './vault/initialize-vault.js';
export type { LockVaultResponse } from './vault/lock-vault.js';
export { LockVaultResponseSchema } from './vault/lock-vault.js';
export type { VaultIdParams } from './vault/params.js';
// Vault lifecycle
export { VaultIdParamsSchema } from './vault/params.js';
export type {
	RecoverVaultRequest,
	RecoverVaultRequestInput,
	RecoverVaultResponse,
} from './vault/recover-vault.js';
export { RecoverVaultRequestSchema, RecoverVaultResponseSchema } from './vault/recover-vault.js';
export type {
	UnlockVaultRequest,
	UnlockVaultRequestInput,
	UnlockVaultResponse,
} from './vault/unlock-vault.js';
export { UnlockVaultRequestSchema, UnlockVaultResponseSchema } from './vault/unlock-vault.js';
export type { VaultStatusResponse } from './vault/vault-status.js';
export { VaultStatusResponseSchema, VaultStatusSchema } from './vault/vault-status.js';
