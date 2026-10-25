import { z } from 'zod';

import {
	boundedNonBlankString,
	LABEL_MAX_LENGTH,
	LONG_TEXT_MAX_LENGTH,
	SHORT_TEXT_MAX_LENGTH,
	TITLE_MAX_LENGTH,
} from './conventions.js';

export const ShortTextSchema: z.ZodType<string> = boundedNonBlankString(1, SHORT_TEXT_MAX_LENGTH);

export const TitleSchema: z.ZodType<string> = boundedNonBlankString(1, TITLE_MAX_LENGTH);

export const LabelSchema: z.ZodType<string> = boundedNonBlankString(1, LABEL_MAX_LENGTH);

export const LongTextSchema: z.ZodType<string> = boundedNonBlankString(1, LONG_TEXT_MAX_LENGTH);

// A required, nullable string: `null` clears the field. Use `.optional()` to
// represent "leave unchanged", and `.nullable().optional()` only when an
// omitted field (as opposed to an explicit null) must be valid.
export const ClearableStringSchema: z.ZodType<string | null, string | null> = boundedNonBlankString(
	1,
	LONG_TEXT_MAX_LENGTH,
).nullable();
