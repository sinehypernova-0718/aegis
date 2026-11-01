<script setup lang="ts">
import { motion, AnimatePresence } from 'motion-v';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-vue-next';
import { useVaultStore } from '@/stores/vaultStore';

const store = useVaultStore();

function getIcon(type: string) {
	switch (type) {
		case 'success':
			return CheckCircle;
		case 'error':
			return AlertCircle;
		case 'warning':
			return AlertTriangle;
		default:
			return Info;
	}
}

function getColor(type: string) {
	switch (type) {
		case 'success':
			return 'var(--success)';
		case 'error':
			return 'var(--danger)';
		case 'warning':
			return 'var(--warning)';
		default:
			return 'var(--accent-primary)';
	}
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      <AnimatePresence>
        <motion.div
          v-for="n in store.notifications"
          :key="n.id"
          :initial="{ opacity: 0, x: 20, scale: 0.95 }"
          :animate="{ opacity: 1, x: 0, scale: 1, transition: { type: 'spring', stiffness: 420, damping: 30, mass: 0.9 } }"
          :exit="{ opacity: 0, x: 24, scale: 0.95, transition: { duration: 0.18, ease: [0.55, 0, 1, 0.45] } }"
          class="flex items-start gap-3 p-3 rounded-lg border"
          :style="{
            background: 'var(--surface-primary)',
            borderColor: getColor(n.type) + '40',
            boxShadow: 'var(--shadow-lg)',
          }"
        >
          <component :is="getIcon(n.type)" :size="16" :style="{ color: getColor(n.type), flexShrink: 0, marginTop: '1px' }" />
          <div class="flex-1 min-w-0">
            <p class="text-[12px] font-medium" :style="{ color: 'var(--text-primary)' }">{{ n.title }}</p>
            <p v-if="n.message" class="text-[11px] mt-0.5" :style="{ color: 'var(--text-tertiary)' }">{{ n.message }}</p>
          </div>
          <button
            @click="store.dismissNotification(n.id)"
            class="p-0.5 rounded transition-colors"
            :style="{ color: 'var(--text-tertiary)' }"
            @mouseenter="($event.target as HTMLElement).style.color = 'var(--text-primary)'"
            @mouseleave="($event.target as HTMLElement).style.color = 'var(--text-tertiary)'"
          >
            <X :size="12" />
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  </Teleport>
</template>
