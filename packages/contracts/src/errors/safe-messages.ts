import type { ErrorCode } from './codes.js';

// Safe, generic messages only. These must never include request data, secrets,
// stack traces, or implementation details.
export const SAFE_ERROR_MESSAGES: Readonly<Record<ErrorCode, string>> = {
	VALIDATION_ERROR: 'The request is invalid.',
	UNAUTHENTICATED: 'Authentication is required.',
	FORBIDDEN: 'You do not have permission to perform this action.',
	NOT_FOUND: 'The requested resource was not found.',
	CONFLICT: 'The request conflicts with the current state.',
	VAULT_LOCKED: 'The vault is locked.',
	RATE_LIMITED: 'Too many requests. Please try again later.',
	INTERNAL_ERROR: 'An internal error occurred.',
};

Object.freeze(SAFE_ERROR_MESSAGES);

export function safeMessageForCode(code: ErrorCode): string {
	return SAFE_ERROR_MESSAGES[code];
}
