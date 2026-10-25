import { z } from 'zod';

import { ErrorCodeSchema } from './codes.js';
import {
	ERROR_DETAIL_MAX_COUNT,
	ERROR_DETAIL_MESSAGE_MAX_LENGTH,
	ERROR_DETAIL_PATH_MAX_LENGTH,
	ERROR_MESSAGE_MAX_LENGTH,
	REQUEST_ID_MAX_LENGTH,
	boundedString,
	strictObject,
} from '../common/conventions.js';

// Structurally safe detail entry: only a field path and a generic message.
// Safety of the message text is enforced by server-side mapping via
// `safeMessageForCode`; this schema intentionally cannot distinguish safe
// strings from secret-bearing strings.
export const ErrorDetailSchema = strictObject({
	path: boundedString(1, ERROR_DETAIL_PATH_MAX_LENGTH),
	message: boundedString(1, ERROR_DETAIL_MESSAGE_MAX_LENGTH),
});

export const ErrorResponseSchema = strictObject({
	code: ErrorCodeSchema,
	message: boundedString(1, ERROR_MESSAGE_MAX_LENGTH),
	requestId: boundedString(1, REQUEST_ID_MAX_LENGTH).optional(),
	details: z.array(ErrorDetailSchema).max(ERROR_DETAIL_MAX_COUNT).optional(),
});

export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
