import { z } from 'zod';

import { ErrorCodeSchema } from './codes.js';
import type { ErrorCode } from './codes.js';
import {
	ERROR_DETAIL_MAX_COUNT,
	ERROR_DETAIL_MESSAGE_MAX_LENGTH,
	ERROR_DETAIL_PATH_MAX_LENGTH,
	ERROR_MESSAGE_MAX_LENGTH,
	REQUEST_ID_MAX_LENGTH,
} from '../common/conventions.js';

// Manual structural types keep declaration emit explicit without circular
// z.infer usage. They mirror the Zod schema shapes exactly.
export type ErrorDetail = {
	path: string;
	message: string;
};

export type ErrorResponse = {
	code: ErrorCode;
	message: string;
	requestId?: string | undefined;
	details?: ErrorDetail[] | undefined;
};

// Structurally safe detail entry: only a field path and a generic message.
export const ErrorDetailSchema: z.ZodType<ErrorDetail> = z
	.object({
		path: z.string().min(1).max(ERROR_DETAIL_PATH_MAX_LENGTH),
		message: z.string().min(1).max(ERROR_DETAIL_MESSAGE_MAX_LENGTH),
	})
	.strict();

export const ErrorResponseSchema: z.ZodType<ErrorResponse> = z
	.object({
		code: ErrorCodeSchema,
		message: z.string().min(1).max(ERROR_MESSAGE_MAX_LENGTH),
		requestId: z.string().min(1).max(REQUEST_ID_MAX_LENGTH).optional(),
		details: z.array(ErrorDetailSchema).max(ERROR_DETAIL_MAX_COUNT).optional(),
	})
	.strict();
