import { z } from 'zod';

import {
	CURSOR_MAX_LENGTH,
	PAGINATION_DEFAULT_LIMIT,
	PAGINATION_MAX_LIMIT,
} from './conventions.js';

export const PaginationLimitSchema: z.ZodType<number, number | undefined> = z
	.number()
	.int()
	.min(1)
	.max(PAGINATION_MAX_LIMIT);

export const PaginationLimitWithDefaultSchema: z.ZodType<number, number | undefined> =
	PaginationLimitSchema.default(PAGINATION_DEFAULT_LIMIT);

export const OpaqueCursorSchema: z.ZodType<string, string | undefined> = z
	.string()
	.min(1)
	.max(CURSOR_MAX_LENGTH);

export const PaginationQuerySchema: z.ZodType<
	{ limit: number; cursor?: string | null | undefined },
	{ limit?: number | undefined; cursor?: string | null | undefined }
> = z
	.object({
		limit: PaginationLimitWithDefaultSchema,
		cursor: OpaqueCursorSchema.nullable().optional(),
	})
	.strict();

export type PaginationQueryInput = z.input<typeof PaginationQuerySchema>;

export type PaginationQuery = z.output<typeof PaginationQuerySchema>;
