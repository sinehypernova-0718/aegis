<script setup lang="ts">
/**
 * AppTooltip — hover/focus tooltip presentation primitive.
 *
 * Unopinionated: consumers pass content via slot; positioning is a simple
 * side-aware absolute bubble (full floating-ui placement deliberately avoided
 * to keep the dependency budget empty). Delay + fade follow motion tokens.
 */
import { ref } from 'vue';
import { motion, AnimatePresence } from 'motion-v';
import { durations, easings } from '@/motion/tokens';

type Side = 'top' | 'bottom';

interface Props {
	side?: Side;
}

withDefaults(defineProps<Props>(), { side: 'top' });

const open = ref(false);

const enterTransition = { duration: durations.control, ease: easings.out };
const exitTransition = { duration: durations.micro, ease: easings.in };
</script>

<template>
  <span
    class="relative inline-flex"
    @mouseenter="open = true"
    @mouseleave="open = false"
    @focusin="open = true"
    @focusout="open = false"
  >
    <slot name="trigger" />
    <AnimatePresence>
      <motion.span
        v-if="open"
        :initial="{ opacity: 0, y: side === 'top' ? 4 : -4, scale: 0.96 }"
        :animate="{ opacity: 1, y: 0, scale: 1, transition: enterTransition }"
        :exit="{ opacity: 0, y: side === 'top' ? 2 : -2, scale: 0.97, transition: exitTransition }"
        role="tooltip"
        class="a-glass a-glass--elevated absolute left-1/2 z-50 whitespace-nowrap px-2.5 py-1 text-[12px] pointer-events-none"
        :class="side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'"
        :style="{ color: 'var(--text-primary)', transformOrigin: 'center', marginLeft: '-50%' }"
      >
        <slot />
      </motion.span>
    </AnimatePresence>
  </span>
</template>
