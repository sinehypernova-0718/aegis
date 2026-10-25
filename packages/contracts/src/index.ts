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
