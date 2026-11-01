<script setup lang="ts">
/**
 * MotionStagger — group entrance choreography.
 *
 * Parent drives `variants` with staggerChildren; children are motion elements
 * carrying the matching implicit variant names ("hidden" / "visible") via
 * `MotionStaggerItem` (exported from this file's sibling usage in views).
 * Fires on mount (page-level sequences) or when scrolled into view,
 * depending on the `when` prop. Reduced motion collapses to a plain fade.
 */
import { computed } from 'vue';
import { motion } from 'motion-v';
import { durations, easings, staggers } from '../tokens';
import { useAppReducedMotion } from '../composables/useReducedMotion';

type StaggerTag = 'div' | 'section' | 'ul' | 'ol' | 'nav' | 'header' | 'footer';

interface Props {
	/** Stagger interval override (seconds). Defaults to section cadence. */
	interval?: number;
	/** Trigger on mount or when scrolled into view. */
	when?: 'mount' | 'view';
	/** Delay before the first child enters (seconds). */
	delayChildren?: number;
	/** Rendered element tag. */
	tag?: StaggerTag;
}

const props = withDefaults(defineProps<Props>(), {
	interval: staggers.section,
	when: 'mount',
	delayChildren: 0.05,
	tag: 'div',
});

const { reduced } = useAppReducedMotion();

const el = computed(() => motion[props.tag]);

const parentVariants = computed(() => ({
	hidden: {},
	visible: {
		transition: {
			staggerChildren: props.interval,
			delayChildren: props.delayChildren,
		},
	},
	// Reduced-motion pair: parent fades as one unit, children move instantly.
	fade: {
		opacity: 1,
		transition: { duration: durations.control, ease: easings.out },
	},
}));

// Reduced motion collapses the whole group into a single quiet fade: parent
// and children share one `fade` variant pair instead of spatial movement.
const animateState = computed<string | undefined>(() =>
	props.when === 'mount' ? (reduced.value ? 'fade' : 'visible') : undefined,
);

const inViewTarget = computed<string | undefined>(() =>
	props.when === 'view' ? (reduced.value ? 'fade' : 'visible') : undefined,
);
</script>

<template>
  <!-- v-bind instead of `:animate="animateState"`: motion-v's `animate` prop
       type does not accept `| undefined` bindings; omitting the key is
       equivalent (whileInView/variants drive animation when unset). -->
  <component
    :is="el"
    :variants="parentVariants"
    :initial="reduced ? { opacity: 0 } : 'hidden'"
    v-bind="animateState !== undefined ? { animate: animateState } : {}"
    :while-in-view="inViewTarget"
    :in-view-options="{ once: true, amount: 0.15 }"
  >
    <slot />
  </component>
</template>
