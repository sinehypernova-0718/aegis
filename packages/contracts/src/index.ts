export const packageName = '@aegis/contracts' as const;

// Common primitives
export { ENTITY_ID_MAX_LENGTH } from './common/conventions.js';
export type { EntityId } from './common/ids.js';
export { EntityIdSchema } from './common/ids.js';
export type { IsoUtcTimestamp } from './common/timestamps.js';
export { IsoUtcTimestampSchema } from './common/timestamps.js';
export {
	PaginationLimitSchema,
	PaginationLimitWithDefaultSchema,
	PaginationQuerySchema,
	OpaqueCursorSchema,
} from './common/pagination.js';
export type {
	PaginationQuery,
	PaginationQueryInput,
} from './common/pagination.js';
export {
	PAGINATION_DEFAULT_LIMIT,
	PAGINATION_MAX_LIMIT,
	CURSOR_MAX_LENGTH,
	boundedString,
	boundedNonBlankString,
	boundedArray,
	strictObject,
} from './common/conventions.js';
export { ContractVersionSchema, CONTRACT_VERSION } from './common/versions.js';
export type { ContractVersion } from './common/versions.js';
export {
	ShortTextSchema,
	TitleSchema,
	LabelSchema,
	LongTextSchema,
	ClearableStringSchema,
} from './common/primitives.js';

// Shared bounds/constants
export {
	SHORT_TEXT_MAX_LENGTH,
	TITLE_MAX_LENGTH,
	LABEL_MAX_LENGTH,
	LONG_TEXT_MAX_LENGTH,
	ENCRYPTED_PAYLOAD_MAX_BYTES,
	ERROR_DETAIL_MAX_COUNT,
	ERROR_DETAIL_PATH_MAX_LENGTH,
	ERROR_DETAIL_MESSAGE_MAX_LENGTH,
	ERROR_MESSAGE_MAX_LENGTH,
	REQUEST_ID_MAX_LENGTH,
} from './common/conventions.js';

// Errors
export { ErrorCodeSchema, ERROR_CODES } from './errors/codes.js';
export type { ErrorCode } from './errors/codes.js';
export { SAFE_ERROR_MESSAGES, safeMessageForCode } from './errors/safe-messages.js';
export { ErrorDetailSchema, ErrorResponseSchema } from './errors/error-response.js';
export type { ErrorDetail, ErrorResponse } from './errors/error-response.js';

// Vault lifecycle
export { VaultIdParamsSchema } from './vault/params.js';
export type { VaultIdParams } from './vault/params.js';
export {
	PASSPHRASE_MIN_LENGTH,
	PASSPHRASE_MAX_LENGTH,
	PassphraseSchema,
	InitializeVaultRequestSchema,
	InitializeVaultResponseSchema,
	VaultRuntimeStateSchema,
} from './vault/initialize-vault.js';
export type {
	InitializeVaultRequest,
	InitializeVaultRequestInput,
	InitializeVaultResponse,
} from './vault/initialize-vault.js';
export { UnlockVaultRequestSchema, UnlockVaultResponseSchema } from './vault/unlock-vault.js';
export type {
	UnlockVaultRequest,
	UnlockVaultRequestInput,
	UnlockVaultResponse,
} from './vault/unlock-vault.js';
export { LockVaultResponseSchema } from './vault/lock-vault.js';
export type { LockVaultResponse } from './vault/lock-vault.js';
export { VaultStatusSchema, VaultStatusResponseSchema } from './vault/vault-status.js';
export type { VaultStatusResponse } from './vault/vault-status.js';

// Credentials
export { CREDENTIAL_KINDS, CredentialKindSchema } from './credentials/credential-kind.js';
export type { CredentialKind } from './credentials/credential-kind.js';
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
export type {
	CredentialPayload,
	CredentialPayloadFields,
	CredentialPayloadInput,
} from './credentials/credential-payload.js';
export { CredentialParamsSchema } from './credentials/params.js';
export type { CredentialParams } from './credentials/params.js';
export { CredentialSummarySchema } from './credentials/credential-summary.js';
export type { CredentialSummary } from './credentials/credential-summary.js';
export { CredentialDetailSchema } from './credentials/credential-detail.js';
export type { CredentialDetail } from './credentials/credential-detail.js';
export {
	CreateCredentialRequestSchema,
	CreateCredentialResponseSchema,
} from './credentials/create-credential.js';
export type {
	CreateCredentialRequest,
	CreateCredentialRequestInput,
	CreateCredentialResponse,
} from './credentials/create-credential.js';
export {
	UpdateCredentialRequestSchema,
	UpdateCredentialResponseSchema,
} from './credentials/update-credential.js';
export type {
	UpdateCredentialRequest,
	UpdateCredentialRequestInput,
	UpdateCredentialResponse,
} from './credentials/update-credential.js';
export { DeleteCredentialResponseSchema } from './credentials/delete-credential.js';
export type { DeleteCredentialResponse } from './credentials/delete-credential.js';
export {
	ListCredentialsQuerySchema,
	ListCredentialsResponseSchema,
} from './credentials/list-credentials.js';
export type {
	ListCredentialsQuery,
	ListCredentialsQueryInput,
	ListCredentialsResponse,
} from './credentials/list-credentials.js';
