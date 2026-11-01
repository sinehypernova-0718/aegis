/**
 * Shared motion variants. Typed loosely as plain objects so they can be
 * spread into motion-v props (`:initial`, `:animate`, `:exit`) without
 * fighting the library's internal variant generics — no `any` needed.
 */

import { durations, easings, springs, staggers } from './tokens';

export interface MotionState {
	opacity?: number;
	x?: number | string;
	y?: number | string;
	scale?: number;
	filter?: string;
}

/** Vertical entrance used by scroll reveals and stacked content groups. */
export const revealUp = {
	hidden: { opacity: 0, y: 24 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: durations.scrollReveal, ease: easings.out },
	},
} as const;

/** Slightly stronger cinematic entrance for hero/atmospheric compositions. */
export const revealCinematic = {
	hidden: { opacity: 0, y: 32, scale: 0.985 },
	visible: {
		opacity: 1,
		y: 0,
		scale: 1,
		transition: { duration: durations.cinematic, ease: easings.out },
	},
} as const;

/** Parent variant that staggers children as a group enters. */
export function staggerGroup(interval: number = staggers.section) {
	return {
		hidden: {},
		visible: {
			transition: { staggerChildren: interval },
		},
	} as const;
}

/** Child paired with `staggerGroup`. */
export const staggerChild = {
	hidden: { opacity: 0, y: 16 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: durations.component, ease: easings.out },
	},
} as const;

/** Detail-panel content sequence (credential selection signature). */
export function detailSequence() {
	return {
		hidden: {},
		visible: {
			transition: { staggerChildren: staggers.detail, delayChildren: 0.06 },
		},
	} as const;
}

export const detailChild = {
	hidden: { opacity: 0, y: 12 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: durations.component, ease: easings.out },
	},
} as const;

/** Dialog / dropdown surface: spring entrance, quicker dismissal. */
export const dialogSurface = {
	initial: { opacity: 0, scale: 0.94, y: 12 },
	animate: { opacity: 1, scale: 1, y: 0, transition: springs.dialog },
	exit: {
		opacity: 0,
		scale: 0.96,
		y: 8,
		transition: { duration: durations.control, ease: easings.in },
	},
} as const;

export const backdropFade = {
	initial: { opacity: 0 },
	animate: { opacity: 1, transition: { duration: durations.control, ease: easings.out } },
	exit: { opacity: 0, transition: { duration: durations.micro, ease: easings.in } },
} as const;

/** Dropdown/menu surface: scale + opacity, transform-origin handled in CSS. */
export const menuSurface = {
	initial: { opacity: 0, scale: 0.96, y: -4 },
	animate: {
		opacity: 1,
		scale: 1,
		y: 0,
		transition: { duration: durations.control, ease: easings.out },
	},
	exit: {
		opacity: 0,
		scale: 0.97,
		y: -2,
		transition: { duration: durations.micro, ease: easings.in },
	},
} as const;

/** Toast: directional entrance, quick exit. */
export const toastSlide = {
	initial: { opacity: 0, x: 28, scale: 0.96 },
	animate: {
		opacity: 1,
		x: 0,
		scale: 1,
		transition: { type: 'spring', stiffness: 420, damping: 34 },
	},
	exit: {
		opacity: 0,
		x: 24,
		scale: 0.96,
		transition: { duration: durations.micro, ease: easings.in },
	},
} as const;
