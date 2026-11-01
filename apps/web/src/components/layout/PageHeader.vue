<script setup lang="ts">
/**
 * PageHeader - Consistent page header with title, description, and optional actions
 */
defineProps<{
	title: string;
	description?: string;
}>();
</script>

<template>
  <div class="flex items-start justify-between gap-4">
    <div class="flex-1 min-w-0">
      <h1 class="text-[20px] font-semibold tracking-tight text-[var(--text-primary)] leading-tight">
        {{ title }}
      </h1>
      <p v-if="description" class="text-[13px] text-[var(--text-tertiary)] mt-1">
        {{ description }}
      </p>
    </div>
    <div v-if="$slots.actions" class="flex items-center gap-2 shrink-0">
      <slot name="actions" />
    </div>
  </div>
</template>
