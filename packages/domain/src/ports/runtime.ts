/** Process-local clock. Returns a canonical ISO-8601 UTC timestamp (ms precision). */
export interface Clock {
	now(): string;
}

/** Generates entity identifiers (uuid v4). */
export interface IdGenerator {
	generate(): string;
}
