// Shared, reusable Zod conventions for Aegis contract schemas.
//
// Keep bounds explicit and units clear. Strictness is applied at schema
// construction sites so security-sensitive request/response objects reject
// unknown keys deliberately rather than by accident.

export const PAGINATION_DEFAULT_LIMIT = 20 as const;
export const PAGINATION_MAX_LIMIT = 100 as const;
export const CURSOR_MAX_LENGTH = 512 as const;

export const ENTITY_ID_MAX_LENGTH = 36 as const;

// Conservative textual limits in characters. Adjust once concrete catalog and
// vault use cases are implemented.
export const SHORT_TEXT_MAX_LENGTH = 128 as const;
export const TITLE_MAX_LENGTH = 256 as const;
export const LABEL_MAX_LENGTH = 128 as const;
export const LONG_TEXT_MAX_LENGTH = 4096 as const;

// Encrypted payload size limit in bytes. Transport strings must be decoded and
// measured separately before this limit is enforced.
export const ENCRYPTED_PAYLOAD_MAX_BYTES = 65_536 as const;

export const ERROR_DETAIL_MAX_COUNT = 50 as const;
export const ERROR_DETAIL_PATH_MAX_LENGTH = 512 as const;
export const ERROR_DETAIL_MESSAGE_MAX_LENGTH = 256 as const;
export const ERROR_MESSAGE_MAX_LENGTH = 512 as const;
export const REQUEST_ID_MAX_LENGTH = 128 as const;
