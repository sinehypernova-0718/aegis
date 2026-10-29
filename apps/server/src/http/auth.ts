import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { UnlockThrottleConfig } from '../config.js';

/** Generate a cryptographically unpredictable per-launch bearer token. */
export function createApiToken(): string {
	return randomBytes(32).toString('base64url');
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,512}$/;
const BEARER_PATTERN = /^Bearer ([A-Za-z0-9_-]{32,512})$/;

function parseBearer(header: string | undefined): string | null {
	if (typeof header !== 'string') return null;
	const match = BEARER_PATTERN.exec(header);
	return match?.[1] ?? null;
}

function digest(value: string): Buffer {
	return createHash('sha256').update(value, 'utf8').digest();
}

/**
 * Constant-time bearer token verifier.
 *
 * Tokens are compared as SHA-256 digests so differing lengths do not leak
 * through `timingSafeEqual`. The accepted header shape is bounded to avoid
 * hashing arbitrarily large attacker-controlled input.
 */
export class BearerTokenAuthenticator {
	readonly #expectedDigest: Buffer;

	constructor(token: string) {
		if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) {
			throw new TypeError('API token must be 32-512 base64url characters');
		}
		this.#expectedDigest = digest(token);
	}

	verify(header: string | undefined): boolean {
		const token = parseBearer(header);
		if (token === null) return false;
		return timingSafeEqual(digest(token), this.#expectedDigest);
	}
}

/**
 * Bounded, global failed-unlock throttle.
 *
 * State is O(1) and intentionally not keyed by vault id, so changing the vault
 * identifier cannot bypass it. The cooldown expires on its own, so an attacker
 * cannot cause a permanent lockout.
 */
export class UnlockThrottle {
	readonly #config: UnlockThrottleConfig;
	readonly #now: () => number;
	#failures = 0;
	#windowStart = 0;
	#blockedUntil = 0;

	constructor(config: UnlockThrottleConfig, now: () => number = Date.now) {
		if (config.maxFailures < 1) throw new RangeError('maxFailures must be at least 1');
		if (config.windowMs < 1) throw new RangeError('windowMs must be positive');
		if (config.lockoutMs < 1) throw new RangeError('lockoutMs must be positive');
		this.#config = config;
		this.#now = now;
	}

	get blocked(): boolean {
		this.#settle();
		return this.#now() < this.#blockedUntil;
	}

	get retryAfterMs(): number {
		this.#settle();
		return Math.max(0, this.#blockedUntil - this.#now());
	}

	recordFailure(): void {
		const now = this.#now();
		this.#settle();
		if (now < this.#blockedUntil) return;

		if (now - this.#windowStart >= this.#config.windowMs) {
			this.#windowStart = now;
			this.#failures = 0;
		}
		this.#failures += 1;
		if (this.#failures >= this.#config.maxFailures) {
			this.#blockedUntil = now + this.#config.lockoutMs;
			this.#failures = 0;
			this.#windowStart = now;
		}
	}

	recordSuccess(): void {
		this.#failures = 0;
		this.#windowStart = this.#now();
		this.#blockedUntil = 0;
	}

	reset(): void {
		this.recordSuccess();
	}

	#settle(): void {
		if (this.#blockedUntil !== 0 && this.#now() >= this.#blockedUntil) {
			this.#blockedUntil = 0;
			this.#failures = 0;
			this.#windowStart = this.#now();
		}
	}
}
