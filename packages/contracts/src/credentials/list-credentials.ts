import { z } from 'zod';

import {
	CURSOR_MAX_LENGTH,
	PAGINATION_DEFAULT_LIMIT,
	PAGINATION_MAX_LIMIT,
	strictObject,
} from '../common/conventions.js';
import { CredentialSummarySchema, type CredentialSummary } from './credential-summary.js';

export interface ListCredentialsQuery {
	limit: number;
	cursor?: string | null | undefined;
}

export interface ListCredentialsResponse {
	items: CredentialSummary[];
	nextCursor: string | null;
}

/**
 * List query. Values arrive as strings from the query string, so `limit` is
 * coerced; non-numeric or out-of-range values are rejected rather than clamped.
 */
export const ListCredentialsQuerySchema: z.ZodType<ListCredentialsQuery, unknown> = strictObject({
	limit: z.coerce.number().int().min(1).max(PAGINATION_MAX_LIMIT).default(PAGINATION_DEFAULT_LIMIT),
	cursor: z.string().min(1).max(CURSOR_MAX_LENGTH).nullable().optional(),
});

export type ListCredentialsQueryInput = z.input<typeof ListCredentialsQuerySchema>;

export const ListCredentialsResponseSchema: z.ZodType<
	ListCredentialsResponse,
	ListCredentialsResponse
> = strictObject({
	items: z.array(CredentialSummarySchema),
	nextCursor: z.string().min(1).max(CURSOR_MAX_LENGTH).nullable(),
});
