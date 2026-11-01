<script setup lang="ts">
/**
 * MotionReveal — declarative scroll-triggered entrance wrapper.
 *
 * Uses motion-v's `whileInView` + `inViewOptions` (verified against the
 * installed motion-v@2.9.0 declarations). Supports one-time (`once`, default)
 * and replayable reveals, a cinematic intensity option, and collapses to a
 * short opacity-only fade under reduced motion.
 *
 * Dynamic element rendering uses an inline `component :is` map of concrete
 * typed motion components (`motion.div`, `motion.section`, …) rather than
 * forwarding a stringly-typed `as` prop through the generic `Motion`
 * component — this keeps vue-tsc happy without any type assertions.
 */
import { computed } from 'vue';
import { motion } from 'motion-v';
import { durations, easings } from '../tokens';
import { useAppReducedMotion } from '../composables/useReducedMotion';

type RevealTag = 'div' | 'section' | 'article' | 'header' | 'footer' | 'li' | 'span';

interface Props {
	/** Travel distance in px for the vertical entrance. */
	distance?: number;
	/** Reveal once (default) or replay on re-entry. */
	once?: boolean;
	/** Fraction of element visible before triggering (0..1). */
	amount?: number;
	/** Delay before the reveal starts (seconds), for local sequencing. */
	delay?: number;
	/** Stronger cinematic entrance. */
	cinematic?: boolean;
	/** Rendered element tag. */
	tag?: RevealTag;
}

const props = withDefaults(defineProps<Props>(), {
	distance: 24,
	once: true,
	amount: 0.2,
	delay: 0,
	cinematic: false,
	tag: 'div',
});

const { reduced } = useAppReducedMotion();

const el = computed(() => motion[props.tag]);

const hidden = computed(() =>
	reduced.value
		? { opacity: 0 }
		: { opacity: 0, y: props.cinematic ? props.distance * 1.3 : props.distance },
);

const shown = computed(() => ({
	opacity: 1,
	y: 0,
	transition: {
		duration: reduced.value
			? durations.control
			: props.cinematic
				? durations.cinematic
				: durations.scrollReveal,
		delay: reduced.value ? 0 : props.delay,
		ease: easings.out,
	},
}));

// Replayable reveals animate back out when leaving the viewport; one-time
// reveals simply stay put after their first entrance.
const exitState = computed(() =>
	props.once || reduced.value ? undefined : { opacity: 0, y: -props.distance / 2 },
);
</script>

<template>
  <!-- v-bind instead of `:exit="exitState"`: motion-v's `exit` prop type does
       not accept `| undefined` bindings; omitting the key is equivalent. -->
  <component
    :is="el"
    :initial="hidden"
    :while-in-view="shown"
    v-bind="exitState !== undefined ? { exit: exitState } : {}"
    :in-view-options="{ once: props.once, amount: props.amount }"
  >
    <slot />
  </component>
</template>
