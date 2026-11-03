import { describe, expect, it } from 'vitest';

import { UnlockThrottle } from './auth.js';

describe('UnlockThrottle in-flight attempt guard', () => {
	it('allows only one expensive unlock or recovery attempt at a time', () => {
		const throttle = new UnlockThrottle({ maxFailures: 5, windowMs: 60_000, lockoutMs: 60_000 });

		expect(throttle.tryStartAttempt()).toBe(true);
		expect(throttle.tryStartAttempt()).toBe(false);

		throttle.finishAttempt();

		expect(throttle.tryStartAttempt()).toBe(true);
		throttle.finishAttempt();
	});

	it('continues to reject attempts while the failure throttle is blocked', () => {
		let now = 1_000;
		const throttle = new UnlockThrottle(
			{ maxFailures: 1, windowMs: 60_000, lockoutMs: 60_000 },
			() => now,
		);

		throttle.recordFailure();
		expect(throttle.tryStartAttempt()).toBe(false);

		now += 60_001;
		expect(throttle.tryStartAttempt()).toBe(true);
		throttle.finishAttempt();
	});
});
