/**
 * Session preferences composable — single shared source of truth for the
 * frontend-only session preferences (auto-lock timeout, clipboard hygiene
 * preference).
 *
 * Architecture (mirrors useTheme.ts):
 *  - Module-level singleton refs: Settings writes them, Security reads them,
 *    so the two views can never contradict each other.
 *  - Frontend simulation only: values live in reactive session state and are
 *    neither persisted nor enforced by the backend. Real auto-lock enforcement
 *    requires backend session management.
 */

import { computed, ref } from 'vue';

export const AUTO_LOCK_OPTIONS = [
	{ value: 5, label: '5 minutes' },
	{ value: 10, label: '10 minutes' },
	{ value: 15, label: '15 minutes' },
	{ value: 30, label: '30 minutes' },
	{ value: 60, label: '1 hour' },
	{ value: 0, label: 'Never (not recommended)' },
] as const;

export type AutoLockValue = (typeof AUTO_LOCK_OPTIONS)[number]['value'];

const autoLockTimeout = ref<AutoLockValue>(15);
const clearClipboardOnLock = ref(true);

/** Human-readable label for the current auto-lock value, e.g. "15 minutes". */
const autoLockLabel = computed<string>(() => {
	const match = AUTO_LOCK_OPTIONS.find((o) => o.value === autoLockTimeout.value);
	return match ? match.label : `${autoLockTimeout.value} minutes`;
});

export function useSessionPreferences() {
	return {
		AUTO_LOCK_OPTIONS,
		autoLockTimeout,
		autoLockLabel,
		clearClipboardOnLock,
	};
}
