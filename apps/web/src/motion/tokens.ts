/**
 * Motion design tokens — the single source of truth for timing, easing and
 * spring physics across all five motion layers (atmosphere, navigation,
 * scroll choreography, component interaction, state transitions).
 *
 * Durations are in SECONDS (motion-v / framer-motion convention).
 * These map to the approved targets:
 *   micro 120–180ms · control 180–260ms · component 220–350ms
 *   panel 300–450ms · page 400–650ms · cinematic 650–950ms
 *   scroll reveal 450–750ms · stagger interval 45–85ms
 */

export const durations = {
	/** Micro-interactions: hover tints, icon morphs, small toggles. */
	micro: 0.15,
	/** Control transitions: buttons, inputs, dropdowns. */
	control: 0.22,
	/** Component transitions: list rows, cards, detail fragments. */
	component: 0.3,
	/** Panel transitions: filter drawers, side panels. */
	panel: 0.38,
	/** Page transitions: exit phase (dismissal is quicker than entrance). */
	pageExit: 0.28,
	/** Page transitions: enter phase. */
	pageEnter: 0.5,
	/** Cinematic entrances: unlock → workspace, lock → vault screen. */
	cinematic: 0.8,
	/** Scroll-triggered reveals. */
	scrollReveal: 0.6,
} as const;

export type DurationKey = keyof typeof durations;

/** Shared easing conventions. Expressed as cubic-bezier arrays so they can
 *  be passed directly into motion-v `transition.ease`. */
export const easings = {
	/** Signature "exit" curve — smooth deceleration, no abrupt stop. */
	out: [0.16, 1, 0.3, 1] as [number, number, number, number],
	/** Symmetric curve for cross-fades and theme-scale effects. */
	inOut: [0.45, 0, 0.55, 1] as [number, number, number, number],
	/** Gentle ease-in for dismissals that leave the screen. */
	in: [0.55, 0, 1, 0.45] as [number, number, number, number],
} as const;

export type EasingKey = keyof typeof easings;

/** Spring configurations used by spatial movement. Applied intentionally —
 *  not every component gets a spring. */
export const springs = {
	/** Default spatial spring: nav indicator, selection frames, tabs.
	 *  Restrained bounce (≈5% overshoot). */
	snappy: { type: 'spring', stiffness: 480, damping: 34, mass: 0.9 },
	/** Larger surfaces sliding in/out: detail panels, drawers. */
	smooth: { type: 'spring', stiffness: 300, damping: 32, mass: 1 },
	/** Dialog entrance — slight settle for tactility. */
	dialog: { type: 'spring', stiffness: 420, damping: 30, mass: 0.9 },
	/** Scroll-linked smoothing (progress bars, parallax). */
	scroll: { stiffness: 110, damping: 30, restDelta: 0.001 },
} as const;

/** Stagger intervals (seconds). Keep large lists capped via
 *  `cappedStaggerDelay()` so tail items never wait absurdly long. */
export const staggers = {
	/** Dashboard sections, settings groups. */
	section: 0.07,
	/** Credential list rows, search results. */
	item: 0.045,
	/** Detail-panel content sequence. */
	detail: 0.055,
	/** Maximum cumulative delay before clamping kicks in. */
	maxDelay: 0.45,
} as const;

/** Produce a per-index delay that never exceeds `maxDelay`. */
export function cappedStaggerDelay(index: number, interval: number = staggers.item): number {
	return Math.min(index * interval, staggers.maxDelay);
}
