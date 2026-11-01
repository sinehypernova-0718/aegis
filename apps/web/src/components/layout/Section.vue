<script setup lang="ts">
/**
 * Section - Consistent section with optional header
 */
defineProps<{
	title?: string;
	icon?: any;
}>();
</script>

<template>
  <div class="space-y-3">
    <div v-if="title" class="flex items-center gap-2">
      <component v-if="icon" :is="icon" :size="14" class="text-[var(--text-tertiary)]" />
      <h2 class="text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">
        {{ title }}
      </h2>
    </div>
    <slot />
  </div>
</template>
