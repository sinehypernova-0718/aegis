<script setup lang="ts">
/**
 * ModalShell — unopinionated modal presentation primitive.
 *
 * Provides: teleport, scrim, focus trap (Tab cycling + initial focus),
 * Escape-to-close, scroll lock, cinematic enter/exit choreography, and the
 * `a-glass--modal` surface. Slots only — no business logic, no forms.
 */
import { ref, toRef } from 'vue';
import { motion, AnimatePresence } from 'motion-v';
import { durations, easings, springs } from '@/motion/tokens';
import { useModalBehavior } from './useModalBehavior';

interface Props {
	open: boolean;
	/** Accessible name for the dialog region. */
	labelledBy?: string;
	/** Max width of the panel. */
	maxWidth?: string;
}

const props = withDefaults(defineProps<Props>(), {
	maxWidth: '28rem',
});

const emit = defineEmits<{ close: [] }>();

const panelRef = ref<HTMLElement | null>(null);

useModalBehavior(
	toRef(props, 'open'),
	() => panelRef.value,
	() => emit('close'),
);

const scrimTransition = { duration: durations.control, ease: easings.inOut };
</script>

<template>
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="open"
        :initial="{ opacity: 0 }"
        :animate="{ opacity: 1, transition: scrimTransition }"
        :exit="{ opacity: 0, transition: { duration: durations.micro, ease: easings.in } }"
        class="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4"
      >
        <!-- Scrim: dim + light blur only; heavy blur is reserved for the panel -->
        <div
          class="fixed inset-0"
          :style="{ background: 'var(--surface-overlay)', backdropFilter: 'blur(var(--blur-xs))', WebkitBackdropFilter: 'blur(var(--blur-xs))' }"
          @click="emit('close')"
        />

        <motion.div
          ref="panelRef"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="labelledBy"
          :initial="{ opacity: 0, scale: 0.95, y: 14 }"
          :animate="{ opacity: 1, scale: 1, y: 0, transition: springs.dialog }"
          :exit="{ opacity: 0, scale: 0.965, y: 8, transition: { duration: durations.micro, ease: easings.in } }"
          class="a-glass a-glass--modal relative w-full my-auto p-6"
          :style="{ maxWidth, borderRadius: 'var(--radius-xl)' }"
        >
          <slot />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>
