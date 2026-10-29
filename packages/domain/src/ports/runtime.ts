/** Process-local clock. Returns a canonical ISO-8601 UTC timestamp (ms precision). */
export interface Clock {
	now(): string;
}

/** Generates entity identifiers (uuid v4). */
export interface IdGenerator {
	generate(): string;
}

/**
 * Delayed-callback scheduler.
 *
 * `schedule` returns an idempotent cancellation function. Injecting this port
 * keeps idle-lock behaviour deterministic in tests and keeps process timer
 * ownership out of the domain's business logic.
 */
export interface Scheduler {
	schedule(delayMs: number, callback: () => void): () => void;
}
