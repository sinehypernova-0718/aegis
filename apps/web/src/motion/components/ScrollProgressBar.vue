<script setup lang="ts">
/**
 * ScrollProgressBar — scroll-linked progress indicator.
 *
 * Drives a MotionValue straight into `style.scaleX` (transform-only, GPU
 * compositor) so per-frame scrolling never triggers a Vue re-render. Binds to
 * Aegis's actual nested scroll container via the `container` ref prop — no
 * window-scroll assumptions, no manual scroll listeners.
 */
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { motion, useScroll, useSpring } from 'motion-v';
import { springs } from '../tokens';
import { useAppReducedMotion } from '../composables/useReducedMotion';

interface Props {
	/**
	 * The scrolling element to measure (Aegis's PageContainer inner scroller).
	 * Accepts a ref, a getter, or a plain element — Vue templates unwrap
	 * top-level refs, so `:container="pageScroller"` arrives as the element.
	 */
	container: MaybeRefOrGetter<HTMLElement | undefined>;
}

const props = defineProps<Props>();

const { reduced } = useAppReducedMotion();

// useScroll accepts MaybeComputedElementRef — a computed ref is valid, no
// casts. Recomputes when the container ref resolves (PageContainer mounts
// its scroller element after this component's first render).
const { scrollYProgress } = useScroll({ container: computed(() => toValue(props.container)) });

const progress = useSpring(scrollYProgress, {
	stiffness: springs.scroll.stiffness,
	damping: springs.scroll.damping,
	restDelta: springs.scroll.restDelta,
});
</script>

<template>
  <motion.div
    v-if="!reduced"
    class="absolute top-0 left-0 right-0 h-[2px] origin-left z-10 pointer-events-none"
    :style="{ scaleX: progress, background: 'var(--accent-primary)' }"
  />
</template>
