<script setup lang="ts">
/**
 * ThemeToggle — animated light/dark switch bound to the centralized theme
 * state (useTheme). The knob slides with a spring; icons crossfade/rotate.
 * Clicking triggers the animated theme switch (View Transition when
 * available, CSS-interpolation fallback otherwise — handled in useTheme).
 */
import { computed } from 'vue';
import { motion, AnimatePresence } from 'motion-v';
import { Moon, Sun } from 'lucide-vue-next';
import { useTheme } from '@/composables/useTheme';
import { durations, easings, springs } from '@/motion/tokens';

interface Props {
	size?: 'sm' | 'md';
}

const props = withDefaults(defineProps<Props>(), { size: 'md' });

const { theme, toggleTheme } = useTheme();
const isDark = computed(() => theme.value === 'dark');

const dims = computed(() =>
	props.size === 'sm'
		? { track: 'w-11 h-6', knob: 20, pad: 2, icon: 13, travel: 20 }
		: { track: 'w-14 h-7', knob: 24, pad: 3, icon: 15, travel: 28 },
);

function onClick() {
	toggleTheme({ animate: true });
}
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="isDark"
    :aria-label="`Switch to ${isDark ? 'light' : 'dark'} theme`"
    class="relative rounded-full border outline-none transition-colors"
    :class="dims.track"
    :style="{
      background: isDark ? 'var(--surface-tertiary)' : 'var(--a-bluewhite-100)',
      borderColor: isDark ? 'var(--glass-border-strong)' : 'var(--glass-border)',
      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.18)',
    }"
    @click="onClick"
  >
    <!-- Sliding knob -->
    <motion.span
      class="absolute top-0 left-0 grid place-items-center rounded-full"
      :style="{
        width: `${dims.knob}px`,
        height: `${dims.knob}px`,
        marginTop: `${dims.pad}px`,
        marginLeft: `${dims.pad}px`,
        background: isDark ? 'var(--gradient-accent)' : 'linear-gradient(135deg, #ffffff, var(--a-bluewhite-200))',
        boxShadow: isDark ? 'var(--shadow-sm), var(--shadow-accent)' : 'var(--shadow-sm)',
      }"
      :initial="false"
      :animate="{ x: isDark ? dims.travel : 0, rotate: isDark ? 0 : 90 }"
      :transition="springs.snappy"
    >
      <AnimatePresence mode="wait" :initial="false">
        <motion.span
          :key="isDark ? 'moon' : 'sun'"
          :initial="{ opacity: 0, rotate: -70, scale: 0.6 }"
          :animate="{ opacity: 1, rotate: 0, scale: 1, transition: { duration: durations.control, ease: easings.out } }"
          :exit="{ opacity: 0, rotate: 70, scale: 0.6, transition: { duration: durations.micro, ease: easings.in } }"
          class="grid place-items-center"
        >
          <Moon v-if="isDark" :size="dims.icon" :style="{ color: 'var(--text-on-accent)' }" />
          <Sun v-else :size="dims.icon" :style="{ color: 'var(--a-gold-600)' }" />
        </motion.span>
      </AnimatePresence>
    </motion.span>
  </button>
</template>
