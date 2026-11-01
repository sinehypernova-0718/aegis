/**
 * Interaction presets — small, reusable whileHover / whilePress bundles so
 * components share one tactile language instead of inventing per-file values.
 */

import { durations, easings, springs } from './tokens';

/** Buttons: subtle lift on hover, compression on press. */
export const buttonInteraction = {
	whileHover: { y: -1.5 },
	whilePress: { scale: 0.97, y: 0 },
	transition: springs.snappy,
} as const;

/** Ghost/icon buttons: gentler response than primary actions. */
export const iconButtonInteraction = {
	whileHover: { scale: 1.06 },
	whilePress: { scale: 0.92 },
	transition: { duration: durations.micro, ease: easings.out },
} as const;

/** Cards / list rows: quiet elevation, no bounce. */
export const cardInteraction = {
	whileHover: { y: -2 },
	whilePress: { scale: 0.995 },
	transition: { duration: durations.control, ease: easings.out },
} as const;

/** Navigation items: horizontal nudge toward content. */
export const navItemInteraction = {
	whileHover: { x: 2 },
	whilePress: { scale: 0.98 },
	transition: springs.snappy,
} as const;

/** Reveal/copy micro controls: quick state pop on success. */
export const confirmPop = {
	scale: [1, 1.18, 1] as number[],
	transition: { duration: durations.component, ease: easings.out },
};

/** Atmospheric entrance for the locked environment background layers. */
export const atmosphereEnter = (layer: number) =>
	({
		initial: { opacity: 0 },
		animate: {
			opacity: 1,
			transition: {
				duration: durations.cinematic + layer * 0.15,
				ease: easings.out,
				delay: layer * 0.1,
			},
		},
	}) as const;

/** Restrained breathing pulse for the security emblem (idle only — never a
 *  perpetual attention loop; amplitude is deliberately tiny). Paired with a
 *  reduced-motion static alternative in UnlockView. */
export const emblemPulse = {
	animate: {
		scale: [1, 1.03, 1] as number[],
		opacity: [1, 0.92, 1] as number[],
		transition: { duration: 4.5, ease: easings.inOut, repeat: Infinity },
	},
};

/** Theme-switch surface response — used by ThemeToggle and any control that
 *  mutates global theme state. A single quick scale "breath" gives the toggle
 *  tactile closure without competing with the full-page crossfade itself
 *  (owned by the View Transition / .theme-animating fallback). */
export const themeSurfaceTransition = {
	initial: false,
	animate: {
		scale: [1, 0.96, 1] as number[],
		transition: { duration: durations.control, ease: easings.out },
	},
};

/** Verification-in-progress indicator: one confident sweep, not a spinner
 *  theatre. Driven by state, so it never fabricates success. */
export const verifySweep = {
	initial: { scaleX: 0, opacity: 0 },
	animate: {
		scaleX: 1,
		opacity: 1,
		transition: { duration: durations.cinematic, ease: easings.out },
	},
} as const;
