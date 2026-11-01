<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { motion, AnimatePresence } from 'motion-v';
import { AlertTriangle } from 'lucide-vue-next';
import AppButton from './AppButton.vue';

interface Props {
	open: boolean;
	title: string;
	confirmLabel?: string;
	danger?: boolean;
	confirmVariant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'glass' | 'gold';
}

const props = withDefaults(defineProps<Props>(), {
	confirmLabel: 'Confirm',
	danger: false,
});

const resolvedConfirmVariant = computed(() => {
	if (props.confirmVariant) return props.confirmVariant;
	return props.danger ? 'danger' : 'gold';
});

const emit = defineEmits<{
	confirm: [];
	cancel: [];
}>();

function onKeydown(e: KeyboardEvent) {
	if (e.key === 'Escape') emit('cancel');
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <Teleport to="body">
    <AnimatePresence>
    <motion.div
      v-if="open"
      :initial="{ opacity: 0 }"
      :animate="{ opacity: 1 }"
      :exit="{ opacity: 0, transition: { duration: 0.16, ease: [0.55, 0, 1, 0.45] } }"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="emit('cancel')" />
      <motion.div
        :initial="{ opacity: 0, scale: 0.95, y: 10 }"
        :animate="{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 420, damping: 30, mass: 0.9 } }"
        :exit="{ opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.16, ease: [0.55, 0, 1, 0.45] } }"
        class="a-glass a-glass--modal relative w-full max-w-md p-6"
        :style="{ borderRadius: 'var(--radius-xl)' }"
      >
        <div class="flex items-center gap-2 mb-3">
          <AlertTriangle v-if="danger" :size="16" :style="{ color: 'var(--danger)' }" />
          <h3 class="text-[15px] font-semibold" :style="{ color: 'var(--text-primary)' }">{{ title }}</h3>
        </div>
        <div class="text-[13px] mb-5" :style="{ color: 'var(--text-secondary)' }">
          <slot />
        </div>
        <div class="flex justify-end gap-2">
          <AppButton variant="secondary" @click="emit('cancel')">Cancel</AppButton>
          <AppButton :variant="resolvedConfirmVariant" @click="emit('confirm')">{{ confirmLabel }}</AppButton>
        </div>
      </motion.div>
    </motion.div>
    </AnimatePresence>
  </Teleport>
</template>
