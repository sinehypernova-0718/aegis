/**
 * useNavStack — deliberate directional navigation policy.
 *
 * Aegis has no vue-router; navigation is a Pinia `currentPage` ref, so there
 * is no real history to infer direction from. Instead of treating the sidebar
 * order as "depth" (which would make Overview→Settings feel like going
 * "forward"), we maintain an explicit LIFO stack:
 *
 *   - Navigating to a page already in the stack = going BACK → pull rearward
 *     (direction −1) and pop everything above that entry.
 *   - Navigating to a new destination = pushing deeper → push forward
 *     (direction +1).
 *
 * Rapid repeated navigation stays consistent because every transition reads
 * the immediately-preceding stack state; entries are never stale.
 */

import { computed, readonly, ref, watch, type ComputedRef } from 'vue';
import { useVaultStore } from '@/stores/vaultStore';
import type { MotionDirection } from '../transitions';
import type { PageId } from '@/types';

const MAX_STACK = 8;

export interface NavStackState {
	/** Direction for the most recent navigation (-1 back, 0 neutral, 1 forward). */
	direction: ComputedRef<MotionDirection>;
	/** Monotonic sequence id — lets AnimatePresence keys stay unique under rapid nav. */
	navSeq: ComputedRef<number>;
}

const stack = ref<PageId[]>(['overview']);
const direction = ref<MotionDirection>(0);
const seq = ref(0);

let bound = false;

/** Bind once to the store's currentPage. Called from usePageMotion(). */
function bind(): void {
	if (bound) return;
	bound = true;
	const store = useVaultStore();

	watch(
		() => store.currentPage,
		(next, prev) => {
			if (next === prev) return;
			const top = stack.value[stack.value.length - 1];

			if (next === top) {
				// Re-selection of the current page: neutral, no re-push.
				direction.value = 0;
			} else {
				const idx = stack.value.lastIndexOf(next);
				if (idx >= 0 && idx < stack.value.length - 1) {
					// Destination sits below the top → user is going back.
					direction.value = -1;
					stack.value = stack.value.slice(0, idx + 1);
				} else {
					// New destination → pushing deeper.
					direction.value = 1;
					stack.value = [...stack.value, next].slice(-MAX_STACK);
				}
			}
			seq.value += 1;
		},
	);
}

export function useNavStack(): NavStackState {
	bind();
	return {
		direction: readonly(direction) as ComputedRef<MotionDirection>,
		navSeq: computed(() => seq.value),
	};
}
