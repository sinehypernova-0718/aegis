import { z } from 'zod';

// ... constants as before
export const PAGINATION_DEFAULT_LIMIT = 20 as const;
export const PAGINATION_MAX_LIMIT = 100 as const;
export const CURSOR_MAX_LENGTH = 512 as const;

export const ENTITY_ID_MAX_LENGTH = 36 as const;

export const SHORT_TEXT_MAX_LENGTH = 128 as const;
export const TITLE_MAX_LENGTH = 256 as const;
export const LABEL_MAX_LENGTH = 128 as const;
export const LONG_TEXT_MAX_LENGTH = 4096 as const;

export const ENCRYPTED_PAYLOAD_MAX_BYTES = 65_536 as const;

export const ERROR_DETAIL_MAX_COUNT = 50 as const;
export const ERROR_DETAIL_PATH_MAX_LENGTH = 512 as const;
export const ERROR_DETAIL_MESSAGE_MAX_LENGTH = 256 as const;
export const ERROR_MESSAGE_MAX_LENGTH = 512 as const;
export const REQUEST_ID_MAX_LENGTH = 128 as const;

// Reusable boundary helpers. Strictness stays visible at call sites because
// `strictObject` is the only object helper and always enables `.strict()`.
export function boundedString(minimum: number, maximum: number): z.ZodType<string, string> {
	return z.string().min(minimum).max(maximum);
}

export function boundedNonBlankString(minimum: number, maximum: number): z.ZodType<string, string> {
	return boundedString(minimum, maximum).refine(
		(value) => value.trim().length >= minimum,
		'must contain non-whitespace characters',
	);
}

export function boundedArray<TSchema extends z.ZodType>(
	item: TSchema,
	maximum: number,
): z.ZodType<unknown[], unknown[]> {
	return z.array(item).max(maximum);
}

export function strictObject<TShape extends z.ZodRawShape>(
	shape: TShape,
): z.ZodType<Record<string, unknown>, Record<string, unknown>> {
	return z.object(shape).strict();
}
