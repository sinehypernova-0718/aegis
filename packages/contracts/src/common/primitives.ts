import {
	boundedNonBlankString,
	LABEL_MAX_LENGTH,
	LONG_TEXT_MAX_LENGTH,
	SHORT_TEXT_MAX_LENGTH,
	TITLE_MAX_LENGTH,
} from './conventions.js';

export const ShortTextSchema = boundedNonBlankString(1, SHORT_TEXT_MAX_LENGTH);

export const TitleSchema = boundedNonBlankString(1, TITLE_MAX_LENGTH);

export const LabelSchema = boundedNonBlankString(1, LABEL_MAX_LENGTH);

export const LongTextSchema = boundedNonBlankString(1, LONG_TEXT_MAX_LENGTH);

// A string that is explicitly either present or cleared. Use `.optional()` to
// represent "leave unchanged"; use `.nullable().optional()` to represent
// "clear when null".
export const ClearableStringSchema = boundedNonBlankString(1, LONG_TEXT_MAX_LENGTH).nullable();
