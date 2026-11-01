/**
 * usePageMotion — coordinates directional page transitions with the
 * store-driven navigation model (Aegis has no vue-router; currentPage is a
 * Pinia ref). Direction comes from the explicit nav-stack policy in
 * `useNavStack` (deeper = forward, revisiting an earlier entry = back) rather
 * than any assumption about sidebar ordering. Exposes reduced-motion-aware
 * transition specs for AnimatePresence.
 */

import { computed, type ComputedRef } from 'vue';
import { useVaultStore } from '@/stores/vaultStore';
import { pageTransition, type PageTransitionSpec } from '../transitions';
import { useAppReducedMotion } from './useReducedMotion';
import { useNavStack } from './useNavStack';
import type { PageId } from '@/types';

export interface PageMotionState {
	/** Current page key driving AnimatePresence. */
	pageKey: ComputedRef<PageId>;
	/** Transition spec for the active page (reduced-motion aware). */
	transition: ComputedRef<PageTransitionSpec>;
}

export function usePageMotion(): PageMotionState {
	const store = useVaultStore();
	const { reduced } = useAppReducedMotion();
	const { direction } = useNavStack();

	const transition = computed<PageTransitionSpec>(() => {
		if (reduced.value) {
			// Reduced motion: pure opacity crossfade, no spatial movement.
			return {
				initial: { opacity: 0 },
				animate: { opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } },
				exit: { opacity: 0, transition: { duration: 0.15, ease: 'easeIn' } },
			};
		}
		return pageTransition(direction.value);
	});

	return {
		pageKey: computed(() => store.currentPage),
		transition,
	};
}
