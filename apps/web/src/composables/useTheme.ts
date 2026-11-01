/**
 * Theme composable — centralized light/dark state with animated switching.
 *
 * Architecture:
 *  - Module-level singleton ref: every consumer shares one theme source.
 *  - The pre-paint bootstrap in index.html applies the stored/system theme
 *    before first render (no flash of the wrong theme); initTheme() here only
 *    re-syncs Vue state and subscribes to system-preference changes.
 *  - Animated switching prefers the View Transitions API (Chromium/Win11):
 *    a real crossfade between full-page snapshots — no layout shift, no
 *    flashing. Where unavailable, we fall back to the `.theme-animating`
 *    class which interpolates tokenized surface properties via CSS.
 *  - Reduced motion: both paths collapse to an instant swap (the CSS media
 *    query zeroes animation/transition durations), so behavior never breaks.
 */

import { computed, onMounted, ref, watch } from 'vue';
import type { ComputedRef } from 'vue';
import type { ThemeMode } from '@/types';

const STORAGE_KEY = 'aegis-theme';

const theme = ref<ThemeMode>('dark');

let initialized = false;

function getSystemPreference(): ThemeMode {
	if (typeof window === 'undefined') return 'dark';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme(): ThemeMode | null {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === 'light' || stored === 'dark') return stored;
	} catch {
		// localStorage may be unavailable
	}
	return null;
}

function applyTheme(mode: ThemeMode): void {
	document.documentElement.setAttribute('data-theme', mode);
}

/** True when the browser can run snapshot-based view transitions. */
export function supportsViewTransitions(): boolean {
	return typeof document !== 'undefined' && 'startViewTransition' in document;
}

/**
 * The DOM lib now ships `startViewTransition` typings; feature-detection via
 * `supportsViewTransitions()` is enough. No custom Document interface needed
 * (extending Document would conflict with the built-in signature).
 */

/** Duration of the CSS-interpolation fallback, matching --duration-component. */
const FALLBACK_TRANSITION_MS = 320;

/** Apply a theme change with a cinematic crossfade. */
function applyThemeAnimated(mode: ThemeMode): void {
	if (supportsViewTransitions() && typeof document.startViewTransition === 'function') {
		const transition = document.startViewTransition(() => {
			applyTheme(mode);
		});
		// Never leave the promise unhandled (e.g. if the transition is skipped).
		void transition.finished.catch(() => undefined);
		return;
	}

	// Fallback: interpolate tokenized colors for one controlled beat.
	const root = document.documentElement;
	root.classList.add('theme-animating');
	applyTheme(mode);
	window.setTimeout(() => root.classList.remove('theme-animating'), FALLBACK_TRANSITION_MS);
}

export interface ThemeState {
	/** Shared reactive theme mode. */
	theme: ComputedRef<ThemeMode>;
	setTheme(mode: ThemeMode, options?: { animate?: boolean }): void;
	toggleTheme(options?: { animate?: boolean }): void;
	initTheme(): void;
}

export function useTheme(): ThemeState {
	function persist(mode: ThemeMode): void {
		try {
			localStorage.setItem(STORAGE_KEY, mode);
		} catch {
			// Ignore storage errors
		}
	}

	function setTheme(mode: ThemeMode, options?: { animate?: boolean }): void {
		if (mode === theme.value) return;
		theme.value = mode;
		persist(mode);
		if (options?.animate) applyThemeAnimated(mode);
		else applyTheme(mode);
	}

	function toggleTheme(options?: { animate?: boolean }): void {
		setTheme(theme.value === 'dark' ? 'light' : 'dark', options);
	}

	function initTheme(): void {
		if (initialized) return;
		initialized = true;

		// The inline bootstrap already painted the correct theme; adopt its value.
		const bootstrapped = document.documentElement.getAttribute('data-theme');
		theme.value =
			bootstrapped === 'light' || bootstrapped === 'dark'
				? bootstrapped
				: (getStoredTheme() ?? getSystemPreference());
		applyTheme(theme.value);

		if (typeof window !== 'undefined') {
			window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
				// Only auto-switch while the user has no explicit preference.
				if (!getStoredTheme()) {
					theme.value = e.matches ? 'dark' : 'light';
					applyTheme(theme.value);
				}
			});
		}
	}

	onMounted(() => {
		initTheme();
	});

	watch(theme, (newTheme) => {
		applyTheme(newTheme);
	});

	return {
		theme: computed(() => theme.value),
		setTheme,
		toggleTheme,
		initTheme,
	};
}
