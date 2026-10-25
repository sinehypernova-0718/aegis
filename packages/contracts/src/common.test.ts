import { describe, expect, it } from 'vitest';

import { EntityIdSchema, IsoUtcTimestampSchema } from './index.js';

describe('@aegis/contracts common primitives', () => {
	it('accepts a valid UUID entity id', () => {
		expect(EntityIdSchema.parse('123e4567-e89b-12d3-a456-426614174000')).toBe(
			'123e4567-e89b-12d3-a456-426614174000',
		);
	});

	it('rejects malformed entity ids', () => {
		expect(() => EntityIdSchema.parse('not-a-uuid')).toThrow();
		expect(() => EntityIdSchema.parse(123)).toThrow();
	});

	it('accepts a canonical UTC timestamp', () => {
		expect(IsoUtcTimestampSchema.parse('2026-10-25T01:30:00.000Z')).toBe(
			'2026-10-25T01:30:00.000Z',
		);
	});

	it('rejects non-canonical or impossible timestamps', () => {
		expect(() => IsoUtcTimestampSchema.parse('2026-10-25T01:30:00Z')).toThrow();
		expect(() => IsoUtcTimestampSchema.parse('2026-02-30T01:30:00.000Z')).toThrow();
		expect(() => IsoUtcTimestampSchema.parse('2026-10-25T01:30:00.000+02:00')).toThrow();
	});
});
