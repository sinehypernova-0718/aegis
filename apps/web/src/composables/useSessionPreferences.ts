/**
 * Session preferences composable — single shared source of truth for the
 * local session preferences (auto-lock timeout display, clipboard hygiene
 * preference).
 *
 * Architecture (mirrors useTheme.ts):
 *  - Module-level singleton refs: Settings writes them, Security reads them,
 *    so the two views can never contradict each other.
 *  - Device persistence: values are saved to AND restored from
 *    `localStorage` (non-sensitive: a timeout number and a boolean), so the
 *    preferences survive page reloads and browser restarts.
 *  - Non-authoritative by design: the BACKEND enforces idle auto-lock on its
 *    own configured window (default 5 minutes, `AEGIS_IDLE_TIMEOUT_MS`);
 *    these preferences describe intent on this device and are not yet wired
 *    into the backend's session authority.
 */

import { computed, ref, watch } from 'vue';

export const AUTO_LOCK_OPTIONS = [
	{ value: 5, label: '5 minutes' },
	{ value: 10, label: '10 minutes' },
	{ value: 15, label: '15 minutes' },
	{ value: 30, label: '30 minutes' },
	{ value: 60, label: '1 hour' },
	{ value: 0, label: 'Never (not recommended)' },
] as const;

export type AutoLockValue = (typeof AUTO_LOCK_OPTIONS)[number]['value'];

const STORAGE_KEY = 'aegis.sessionPreferences.v1';

interface PersistedPreferences {
	readonly autoLockTimeout?: AutoLockValue;
	readonly clearClipboardOnLock?: boolean;
}

function loadPersisted(): PersistedPreferences {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw === null) return {};
		const parsed = JSON.parse(raw) as PersistedPreferences;
		const autoLock = AUTO_LOCK_OPTIONS.some((option) => option.value === parsed.autoLockTimeout)
			? (parsed.autoLockTimeout as AutoLockValue)
			: undefined;
		const clipboard =
			typeof parsed.clearClipboardOnLock === 'boolean' ? parsed.clearClipboardOnLock : undefined;
		return {
			...(autoLock !== undefined ? { autoLockTimeout: autoLock } : {}),
			...(clipboard !== undefined ? { clearClipboardOnLock: clipboard } : {}),
		};
	} catch {
		// Missing, corrupted, or inaccessible storage falls back to defaults.
		return {};
	}
}

const persistedDefaults = loadPersisted();
const autoLockTimeout = ref<AutoLockValue>(persistedDefaults.autoLockTimeout ?? 15);
const clearClipboardOnLock = ref(persistedDefaults.clearClipboardOnLock ?? true);

/** Human-readable label for the current auto-lock value, e.g. "15 minutes". */
const autoLockLabel = computed<string>(() => {
	const match = AUTO_LOCK_OPTIONS.find((o) => o.value === autoLockTimeout.value);
	return match ? match.label : `${autoLockTimeout.value} minutes`;
});

let persistTimer: number | null = null;
function persist(): void {
	if (persistTimer !== null) window.clearTimeout(persistTimer);
	// Debounced write: rapid toggling (e.g. switch clicks) coalesces.
	persistTimer = window.setTimeout(() => {
		persistTimer = null;
		try {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					autoLockTimeout: autoLockTimeout.value,
					clearClipboardOnLock: clearClipboardOnLock.value,
				}),
			);
		} catch {
			/* storage unavailable (private mode/quota): preferences stay session-only */
		}
	}, 250);
}

watch([autoLockTimeout, clearClipboardOnLock], persist);

export function useSessionPreferences() {
	return {
		AUTO_LOCK_OPTIONS,
		autoLockTimeout,
		autoLockLabel,
		clearClipboardOnLock,
	};
}
