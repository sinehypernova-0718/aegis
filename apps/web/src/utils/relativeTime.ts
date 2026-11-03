export interface RelativeTimeOptions {
	/** Compact labels omit "ago" and use day counts instead of calendar dates. */
	readonly compact?: boolean;
	/** Current time in milliseconds; injectable to keep callers and tests deterministic. */
	readonly now?: number;
}

/** Format a timestamp using Aegis's minute/hour/day display thresholds. */
export function formatRelativeTime(
	dateString: string,
	{ compact = false, now = Date.now() }: RelativeTimeOptions = {},
): string {
	const date = new Date(dateString);
	const minutes = Math.floor((now - date.getTime()) / 60_000);
	if (minutes < 1) return 'just now';
	if (minutes < 60) return `${minutes}m${compact ? '' : ' ago'}`;

	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h${compact ? '' : ' ago'}`;

	const days = Math.floor(hours / 24);
	if (compact || days < 30) return `${days}d${compact ? '' : ' ago'}`;
	return date.toLocaleDateString();
}
