/**
 * Page transition definitions — directional, layered and coordinated with
 * the workspace entry. Direction is derived from navigation depth so moving
 * deeper into the app pushes content forward, going back pulls it rearward.
 */

import type { VariantType } from 'motion-v';
import { durations, easings } from './tokens';

/** Direction of a navigation: -1 = back (toward an earlier stack entry),
 *  0 = neutral, +1 = forward (deeper into the app). Owned by useNavStack's
 *  explicit LIFO policy — NOT by sidebar ordering. */
export type MotionDirection = -1 | 0 | 1;

export interface PageTransitionSpec {
	initial: VariantType;
	animate: VariantType;
	exit: VariantType;
}

/**
 * Build a directional page transition. Exit is quicker than entrance
 * (dismissal rule) and the incoming page arrives with a subtle spatial
 * offset along x, communicating where the user came from / is going.
 */
export function pageTransition(direction: MotionDirection): PageTransitionSpec {
	// Same-page or neutral navigation: pure fade-lift, no directional bias.
	const shift = direction === 0 ? 0 : direction * 26;

	return {
		initial: {
			opacity: 0,
			x: shift,
			// Conditional spread instead of `filter: undefined`: the motion-v
			// CSS properties are optional without `| undefined` (EOPT-hostile).
			...(direction !== 0 && { filter: 'blur(2px)' }),
		},
		animate: {
			opacity: 1,
			x: 0,
			filter: 'blur(0px)',
			transition: {
				duration: durations.pageEnter,
				ease: easings.out,
			},
		},
		exit: {
			opacity: 0,
			x: direction === 0 ? 0 : -direction * 18,
			transition: {
				duration: durations.pageExit,
				ease: easings.in,
			},
		},
	};
}

/** Workspace-level transitions for the locked ↔ unlocked environments.
 *  These are cinematic: the vault recedes, the workspace assembles. */
export const workspaceEnter = {
	initial: { opacity: 0, scale: 0.985 },
	animate: {
		opacity: 1,
		scale: 1,
		transition: { duration: durations.cinematic, ease: easings.out },
	},
} as const;

export const workspaceExit = {
	opacity: 0,
	scale: 0.98,
	transition: { duration: durations.pageExit, ease: easings.in },
} as const;

export const lockScreenEnter = {
	initial: { opacity: 0, scale: 1.02 },
	animate: {
		opacity: 1,
		scale: 1,
		transition: { duration: durations.cinematic, ease: easings.out },
	},
} as const;
