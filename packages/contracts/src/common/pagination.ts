import { z } from 'zod';

import {
	CURSOR_MAX_LENGTH,
	PAGINATION_DEFAULT_LIMIT,
	PAGINATION_MAX_LIMIT,
} from './conventions.js';

export const PaginationLimitSchema: z.ZodType<number> = z
	.number()
	.int()
	.min(1)
	.max(PAGINATION_MAX_LIMIT);

export const PaginationLimitWithDefaultSchema: z.ZodType<number> =
	PaginationLimitSchema.default(PAGINATION_DEFAULT_LIMIT);

export const OpaqueCursorSchema: z.ZodType<string> = z.string().min(1).max(CURSOR_MAX_LENGTH);

// `null` means "no cursor supplied" at the transport level; omission applies
// the default limit of 20. Consumers must preserve the omitted-vs-null
// distinction for `cursor`.
export const PaginationQuerySchema: z.ZodType<
	{ limit?: number; cursor?: string | null },
	{ limit?: any; cursor?: any }
> = z
	.object({
		limit: PaginationLimitWithDefaultSchema.optional(),
		cursor: OpaqueCursorSchema.nullable().optional(),
	})
	.strict();

export type PaginationQueryInput = z.input<typeof PaginationQuerySchema>;
export type PaginationQuery = z.output<typeof PaginationQuerySchema>;
