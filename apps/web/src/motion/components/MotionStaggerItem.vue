<script setup lang="ts">
/**
 * MotionStaggerItem — child of MotionStagger.
 *
 * Carries the implicit "hidden"/"visible"/"fade" variant names so the parent
 * group's staggerChildren choreography reaches it. Under reduced motion the
 * parent drives the `fade` variant instead, which resolves instantly per
 * child (no spatial movement).
 */
import { computed } from 'vue';
import { motion } from 'motion-v';
import { durations, easings } from '../tokens';
import { useAppReducedMotion } from '../composables/useReducedMotion';

type ItemTag = 'div' | 'li' | 'section' | 'article' | 'span' | 'button' | 'a' | 'header';

interface Props {
	/** Rendered element tag. */
	tag?: ItemTag;
	/** Extra entrance distance in px (kept small; parent owns cadence). */
	distance?: number;
}

const props = withDefaults(defineProps<Props>(), {
	tag: 'div',
	distance: 16,
});

const { reduced } = useAppReducedMotion();

const el = computed(() => motion[props.tag]);

const variants = computed(() => ({
	hidden: { opacity: 0, y: reduced.value ? 0 : props.distance },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: durations.component, ease: easings.out },
	},
	fade: {
		opacity: 1,
		y: 0,
		transition: { duration: durations.control, ease: easings.out },
	},
}));
</script>

<template>
  <component :is="el" :variants="variants">
    <slot />
  </component>
</template>
