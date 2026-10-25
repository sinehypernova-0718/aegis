import { describe, expect, it } from 'vitest';

import { ErrorResponseSchema, ErrorCodeSchema } from './index.js';

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

	it('rejects unknown keys and arbitrary detail data', () => {
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
	});

	it('rejects invalid error codes', () => {
		expect(() => ErrorCodeSchema.parse('SECRET_LEAK')).toThrow();
	});

	it('preserves optional-vs-null semantics in pagination queries', async () => {
		const { PaginationQuerySchema } = await import('./index.js');
		// Omission leaves the field undefined.
		expect(PaginationQuerySchema.parse({})).toEqual({});
		// Explicit null is allowed for cursor.
		expect(PaginationQuerySchema.parse({ cursor: null })).toEqual({
			cursor: null,
		});
	});
});
