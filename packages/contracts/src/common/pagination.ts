import { z } from 'zod';

import {
	CURSOR_MAX_LENGTH,
	PAGINATION_DEFAULT_LIMIT,
	PAGINATION_MAX_LIMIT,
} from './conventions.js';

// Base schemas - let Zod infer input/output (no misleading annotations)
// z.number() rejects undefined at runtime; z.string() rejects undefined
export const PaginationLimitSchema: z.ZodType<number, number> = z
	.number()
	.int()
	.min(1)
	.max(PAGINATION_MAX_LIMIT);

// With default, undefined IS accepted at runtime
export const PaginationLimitWithDefaultSchema: z.ZodType<number, number | undefined> =
	PaginationLimitSchema.default(PAGINATION_DEFAULT_LIMIT);

export const OpaqueCursorSchema: z.ZodType<string, string> = z
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
