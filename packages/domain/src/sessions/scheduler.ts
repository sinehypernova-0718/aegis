import type { Scheduler } from '../ports/runtime.js';

/** Default inactivity window before an unlocked vault is locked automatically. */
export const DEFAULT_VAULT_IDLE_TIMEOUT_MS = 300_000 as const; // five minutes

/**
 * Process scheduler backed by the platform timer API.
 *
 * Timers are `unref()`'d so an idle-lock timer alone never keeps the Node
 * process alive; the application lifecycle still cancels them on shutdown.
 */
export const systemScheduler: Scheduler = {
	schedule(delayMs: number, callback: () => void): () => void {
		if (!Number.isFinite(delayMs) || delayMs < 0) {
			throw new RangeError('delayMs must be a non-negative finite number');
		}
		const handle = setTimeout(callback, delayMs);
		if (typeof handle === 'object' && handle !== null && 'unref' in handle) {
			handle.unref();
		}
		let cancelled = false;
		return () => {
			if (cancelled) return;
			cancelled = true;
			clearTimeout(handle);
		};
	},
};
