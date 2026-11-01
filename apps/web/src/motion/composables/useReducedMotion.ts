/**
 * useReducedMotion — reactive `prefers-reduced-motion` support.
 *
 * Wraps motion-v's own `useReducedMotion()` (verified against the installed
 * motion-v@2.9.0 TypeScript declarations: it returns a `Ref<boolean>` and
 * subscribes to the media query itself, cleaning up on unmount). We keep our
 * own thin wrapper so application code has one import point and so we can
 * add the global override used by CSS-side effects later.
 */

import { computed, ref, type ComputedRef } from 'vue';
import { useReducedMotion as useMotionReducedMotion } from 'motion-v';

/** Manual override toggled by app settings; null = follow system. */
const manualOverride = ref<boolean | null>(null);

export function setReducedMotionOverride(value: boolean | null): void {
	manualOverride.value = value;
}

export interface ReducedMotionState {
	/** True when animation should be minimized. */
	reduced: ComputedRef<boolean>;
}

export function useAppReducedMotion(): ReducedMotionState {
	const systemPrefers = useMotionReducedMotion();

	const reduced = computed(() => manualOverride.value ?? Boolean(systemPrefers.value));

	return { reduced };
}

/** Convenience for templates that need the boolean directly. */
export function usePrefersReducedMotion(): ComputedRef<boolean> {
	return useAppReducedMotion().reduced;
}
