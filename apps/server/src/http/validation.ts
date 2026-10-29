import type { z } from 'zod';
import {
	ERROR_DETAIL_MAX_COUNT,
	ERROR_DETAIL_MESSAGE_MAX_LENGTH,
	ERROR_DETAIL_PATH_MAX_LENGTH,
	type ErrorDetail,
} from '@aegis/contracts';

/** Raised when request input fails boundary validation. */
export class RequestValidationError extends Error {
	readonly details: ErrorDetail[];

	constructor(details: ErrorDetail[]) {
		super('request validation failed');
		this.name = 'RequestValidationError';
		this.details = details;
	}
}

type ValidationIssue = z.ZodError['issues'][number];

/**
 * Map a Zod issue code to a fixed, value-free description. Deliberately does
 * not use `issue.message`, which can contain submitted values for some checks.
 */
function safeIssueMessage(issue: ValidationIssue): string {
	switch (issue.code) {
		case 'invalid_type':
			return 'has an invalid type or is missing';
		case 'too_big':
			return 'is too large';
		case 'too_small':
			return 'is too small';
		case 'invalid_format':
			return 'has an invalid format';
		case 'unrecognized_keys':
			return 'contains an unknown field';
		case 'invalid_value':
			return 'has an unsupported value';
		case 'not_multiple_of':
			return 'is not an accepted value';
		case 'invalid_union':
			return 'is invalid';
		case 'invalid_key':
			return 'has an invalid key';
		case 'invalid_element':
			return 'has an invalid element';
		default:
			return 'is invalid';
	}
}

function toSafeDetails(error: z.ZodError): ErrorDetail[] {
	return error.issues.slice(0, ERROR_DETAIL_MAX_COUNT).map((issue) => {
		const joined = issue.path.map((segment) => String(segment)).join('.');
		const path = (joined === '' ? '$' : joined).slice(0, ERROR_DETAIL_PATH_MAX_LENGTH);
		return {
			path: path === '' ? '$' : path,
			message: safeIssueMessage(issue).slice(0, ERROR_DETAIL_MESSAGE_MAX_LENGTH),
		};
	});
}

/**
 * Parse boundary input with a contract schema. On failure this throws a
 * `RequestValidationError` carrying only bounded field paths and fixed
 * descriptions - never submitted values, passphrases, or secrets.
 */
export function parseRequest<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
	const result = schema.safeParse(value);
	if (result.success) return result.data;
	throw new RequestValidationError(toSafeDetails(result.error));
}
