import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from './relativeTime';

const NOW = Date.parse('2026-11-03T12:00:00.000Z');

function timestampMinutesAgo(minutes: number): string {
	return new Date(NOW - minutes * 60_000).toISOString();
}

describe('formatRelativeTime', () => {
	it.each([
		[0, 'just now'],
		[1, '1m ago'],
		[60, '1h ago'],
		[1_440, '1d ago'],
	])('formats %i minutes ago as %s', (minutes, expected) => {
		expect(formatRelativeTime(timestampMinutesAgo(minutes), { now: NOW })).toBe(expected);
	});

	it('uses a localized date after 30 days in the standard presentation', () => {
		const date = new Date(timestampMinutesAgo(30 * 24 * 60));
		expect(formatRelativeTime(date.toISOString(), { now: NOW })).toBe(date.toLocaleDateString());
	});

	it('keeps compact labels without a suffix or calendar-date fallback', () => {
		expect(formatRelativeTime(timestampMinutesAgo(2), { compact: true, now: NOW })).toBe('2m');
		expect(formatRelativeTime(timestampMinutesAgo(25 * 60), { compact: true, now: NOW })).toBe('1d');
		expect(formatRelativeTime(timestampMinutesAgo(30 * 24 * 60), { compact: true, now: NOW })).toBe(
			'30d',
		);
	});

	it('treats future timestamps as just now', () => {
		expect(formatRelativeTime(timestampMinutesAgo(-5), { now: NOW })).toBe('just now');
	});
});
