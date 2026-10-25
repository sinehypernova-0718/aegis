import { z } from 'zod';

export const ERROR_CODES = [
	'VALIDATION_ERROR',
	'UNAUTHENTICATED',
	'FORBIDDEN',
	'NOT_FOUND',
	'CONFLICT',
	'VAULT_LOCKED',
	'RATE_LIMITED',
	'INTERNAL_ERROR',
] as const;

export const ErrorCodeSchema = z.enum(ERROR_CODES);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
