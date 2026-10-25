import { z } from 'zod';

const CANONICAL_UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// Canonical wire representation: YYYY-MM-DDTHH:mm:ss.sssZ.
// The regex enforces shape; the refinement enforces a real UTC calendar date
// without coercion into Date objects and without accepting local time.
export type IsoUtcTimestamp = string & {
	readonly __brand: 'IsoUtcTimestamp';
};

export const IsoUtcTimestampSchema: z.ZodType<IsoUtcTimestamp, string> = z
	.string()
	.regex(CANONICAL_UTC_TIMESTAMP, 'must use canonical UTC timestamp format')
	.refine((value) => {
		const parsed = new Date(value);
		return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
	}, 'must be a valid UTC timestamp')
	.brand<'IsoUtcTimestamp'>() as unknown as z.ZodType<IsoUtcTimestamp, string>;
