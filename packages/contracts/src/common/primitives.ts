import { z } from 'zod';

import {
	LABEL_MAX_LENGTH,
	LONG_TEXT_MAX_LENGTH,
	SHORT_TEXT_MAX_LENGTH,
	TITLE_MAX_LENGTH,
} from './conventions.js';

export const ShortTextSchema: z.ZodString = z.string().min(1).max(SHORT_TEXT_MAX_LENGTH);

export const TitleSchema: z.ZodString = z.string().min(1).max(TITLE_MAX_LENGTH);

export const LabelSchema: z.ZodString = z.string().min(1).max(LABEL_MAX_LENGTH);

export const LongTextSchema: z.ZodString = z.string().min(1).max(LONG_TEXT_MAX_LENGTH);

// A string that is explicitly either present or cleared. Use `.optional()` to
// represent "leave unchanged"; use `.nullable().optional()` to represent
// "clear when null".
export const ClearableStringSchema: z.ZodNullable<z.ZodString> = z.string().min(1).nullable();
