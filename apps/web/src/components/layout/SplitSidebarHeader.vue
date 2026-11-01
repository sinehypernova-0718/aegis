<script setup lang="ts">
/**
 * SplitSidebarHeader - Consistent header for split-layout sidebars
 */
defineProps<{
	title: string;
	subtitle?: string;
}>();
</script>

<template>
  <div class="px-5 pt-14 lg:pt-5 pb-4 border-b" :style="{ borderColor: 'var(--border-subtle)' }">
    <div class="flex items-center justify-between mb-3">
      <div class="min-w-0 flex-1">
        <h1 class="text-[18px] font-semibold tracking-tight text-[var(--text-primary)] leading-tight truncate">
          {{ title }}
        </h1>
        <p v-if="subtitle" class="text-[11px] text-[var(--text-tertiary)] mt-0.5 truncate">
          {{ subtitle }}
        </p>
      </div>
      <div v-if="$slots.actions" class="flex items-center gap-2 shrink-0 ml-3">
        <slot name="actions" />
      </div>
    </div>
    <slot />
  </div>
</template>
