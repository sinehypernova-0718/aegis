import { z } from 'zod';

import { ErrorCodeSchema, ERROR_CODES } from './codes.js';
import {
	ERROR_DETAIL_MAX_COUNT,
	ERROR_DETAIL_MESSAGE_MAX_LENGTH,
	ERROR_DETAIL_PATH_MAX_LENGTH,
	ERROR_MESSAGE_MAX_LENGTH,
	REQUEST_ID_MAX_LENGTH,
	boundedString,
} from '../common/conventions.js';

export const ErrorDetailSchema: z.ZodType<
	{ path: string; message: string },
	{ path: string; message: string }
> = z
	.object({
		path: boundedString(1, ERROR_DETAIL_PATH_MAX_LENGTH),
		message: boundedString(1, ERROR_DETAIL_MESSAGE_MAX_LENGTH),
	})
	.strict();

export const ErrorResponseSchema: z.ZodType<
	{
		code: (typeof ERROR_CODES)[number];
		message: string;
		requestId?: string | undefined;
		details?: Array<{ path: string; message: string }> | undefined;
	},
	{
		code: any;
		message: any;
		requestId?: any;
		details?: any;
	}
> = z
	.object({
		code: ErrorCodeSchema,
		message: boundedString(1, ERROR_MESSAGE_MAX_LENGTH),
		requestId: boundedString(1, REQUEST_ID_MAX_LENGTH).optional(),
		details: z.array(ErrorDetailSchema).max(ERROR_DETAIL_MAX_COUNT).optional(),
	})
	.strict();

export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
