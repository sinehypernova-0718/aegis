<script setup lang="ts">
/**
 * MotionPage — cinematic page shell used inside App.vue's AnimatePresence.
 *
 * Receives the directional transition spec from usePageMotion and applies it
 * as initial/animate/exit. `mode="wait"` at the call site guarantees an
 * exiting page is fully removed before the next one mounts, so rapid
 * navigation never leaves overlapping pages or stale content behind.
 */
import { motion } from 'motion-v';
import type { PageTransitionSpec } from '../transitions';

interface Props {
	/** Directional transition spec (reduced-motion aware, from usePageMotion). */
	spec: PageTransitionSpec;
}

defineProps<Props>();
</script>

<template>
  <motion.div
    :initial="spec.initial"
    :animate="spec.animate"
    :exit="spec.exit"
    class="h-full"
  >
    <slot />
  </motion.div>
</template>
