<script setup lang="ts">
/**
 * EmptyState - Consistent empty state presentation
 */
import type { Component } from 'vue';

defineProps<{
	icon?: Component;
	title: string;
	description?: string;
}>();
</script>

<template>
  <div class="flex flex-col items-center justify-center h-full py-16 px-4">
    <div
      v-if="icon"
      class="w-12 h-12 rounded-lg flex items-center justify-center mb-3"
      :style="{ background: 'var(--surface-tertiary)' }"
    >
      <component :is="icon" :size="20" :style="{ color: 'var(--text-disabled)' }" />
    </div>
    <p class="text-[13px] font-medium text-[var(--text-secondary)]">
      {{ title }}
    </p>
    <p v-if="description" class="text-[11px] text-[var(--text-disabled)] mt-1 text-center">
      {{ description }}
    </p>
    <div v-if="$slots.actions" class="mt-4">
      <slot name="actions" />
    </div>
  </div>
</template>
