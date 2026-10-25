import { z } from 'zod';

import {
	CURSOR_MAX_LENGTH,
	PAGINATION_DEFAULT_LIMIT,
	PAGINATION_MAX_LIMIT,
} from './conventions.js';

export type PaginationQuery = {
	limit?: number | undefined;
	cursor?: string | null | undefined;
};

export const PaginationLimitSchema: z.ZodNumber = z.number().int().min(1).max(PAGINATION_MAX_LIMIT);

export const PaginationLimitWithDefaultSchema: z.ZodDefault<z.ZodNumber> =
	PaginationLimitSchema.default(PAGINATION_DEFAULT_LIMIT);

export const OpaqueCursorSchema: z.ZodString = z.string().min(1).max(CURSOR_MAX_LENGTH);

// `null` means "no cursor supplied" at the transport level; omission means the
// caller did not provide the field. Consumers must preserve that distinction.
export const PaginationQuerySchema: z.ZodType<PaginationQuery> = z
	.object({
		limit: PaginationLimitSchema.optional(),
		cursor: OpaqueCursorSchema.nullable().optional(),
	})
	.strict();
