import { describe, expect, it } from 'vitest';

import {
	ErrorResponseSchema,
	ErrorCodeSchema,
	SAFE_ERROR_MESSAGES,
	safeMessageForCode,
} from './index.js';

describe('@aegis/contracts error envelopes', () => {
	it('accepts a sanitized error response', () => {
		const value = {
			code: 'VALIDATION_ERROR',
			message: 'The request is invalid.',
			requestId: 'req_123',
			details: [{ path: 'title', message: 'must not be empty' }],
		};

		expect(ErrorResponseSchema.parse(value)).toEqual(value);
	});

	it('rejects unknown keys, bad codes, and arbitrary detail fields', () => {
		expect(() =>
			ErrorResponseSchema.parse({
				code: 'VALIDATION_ERROR',
				message: 'The request is invalid.',
				secret: 'must not appear',
			}),
		).toThrow();

		expect(() =>
			ErrorResponseSchema.parse({
				code: 'VALIDATION_ERROR',
				message: 'The request is invalid.',
				details: [{ path: 'password', rawValue: 'secret-value' }],
			}),
		).toThrow();

		expect(() => ErrorCodeSchema.parse('SECRET_LEAK')).toThrow();
	});

	it('never accepts unsafe detail extras', () => {
		expect(() =>
			ErrorResponseSchema.parse({
				code: 'VALIDATION_ERROR',
				message: 'The request is invalid.',
				details: [{}],
			}),
		).toThrow();
	});

	it('maps every error code to a frozen safe message', () => {
		expect(Object.isFrozen(SAFE_ERROR_MESSAGES)).toBe(true);
		for (const code of Object.keys(SAFE_ERROR_MESSAGES)) {
			expect(safeMessageForCode(code as keyof typeof SAFE_ERROR_MESSAGES)).toBe(
				SAFE_ERROR_MESSAGES[code as keyof typeof SAFE_ERROR_MESSAGES],
			);
		}
	});

	it('preserves optional-vs-null semantics in pagination queries', async () => {
		const { PaginationQuerySchema } = await import('./index.js');
		expect(PaginationQuerySchema.parse({})).toEqual({ limit: 20 });
		expect(PaginationQuerySchema.parse({ cursor: null })).toEqual({
			limit: 20,
			cursor: null,
		});
	});
});
