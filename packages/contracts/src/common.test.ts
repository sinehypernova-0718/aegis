import { describe, expect, it } from 'vitest';

import {
	EntityIdSchema,
	IsoUtcTimestampSchema,
	PaginationLimitSchema,
	PaginationQuerySchema,
	TitleSchema,
	ShortTextSchema,
	LongTextSchema,
} from './index.js';

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

	it('rejects blank-ish text values', () => {
		expect(() => TitleSchema.parse('   ')).toThrow();
		expect(() => ShortTextSchema.parse('\t\n')).toThrow();
		expect(() => LongTextSchema.parse('')).toThrow();
	});

	it('accepts meaningful text values', () => {
		expect(TitleSchema.parse('My title')).toBe('My title');
	});

	it('enforces pagination bounds', () => {
		expect(() => PaginationLimitSchema.parse(0)).toThrow();
		expect(() => PaginationLimitSchema.parse(101)).toThrow();
		expect(PaginationLimitSchema.parse(100)).toBe(100);
	});

	it('applies the pagination default limit', () => {
		expect(PaginationQuerySchema.parse({})).toEqual({ limit: 20 });
	});

	it('preserves omitted-vs-null cursor semantics', () => {
		expect(PaginationQuerySchema.parse({})).not.toHaveProperty('cursor');
		expect(PaginationQuerySchema.parse({ cursor: null })).toEqual({
			limit: 20,
			cursor: null,
		});
	});

	it('rejects unknown keys and oversized cursors', () => {
		expect(() => PaginationQuerySchema.parse({ unknown: true })).toThrow();
		expect(() => PaginationQuerySchema.parse({ cursor: 'a'.repeat(513) })).toThrow();
	});
});
