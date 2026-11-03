export interface RelativeTimeOptions {
	/** Compact labels omit "ago" and use day counts instead of calendar dates. */
	readonly compact?: boolean;
	/** Add "ago" to compact minute/hour/day labels when the caller needs it. */
	readonly includeAgo?: boolean;
	/** Current time in milliseconds; injectable to keep callers and tests deterministic. */
	readonly now?: number;
}

/** Format a timestamp using Aegis's minute/hour/day display thresholds. */
export function formatRelativeTime(
	dateString: string,
	{ compact = false, includeAgo = !compact, now = Date.now() }: RelativeTimeOptions = {},
): string {
	const date = new Date(dateString);
	const minutes = Math.floor((now - date.getTime()) / 60_000);
	if (minutes < 1) return 'just now';
	const format = (value: string) => `${value}${includeAgo ? ' ago' : ''}`;
	if (minutes < 60) return format(`${minutes}m`);

	const hours = Math.floor(minutes / 60);
	if (hours < 24) return format(`${hours}h`);

	const days = Math.floor(hours / 24);
	if (compact || days < 30) return format(`${days}d`);
	return date.toLocaleDateString();
}
