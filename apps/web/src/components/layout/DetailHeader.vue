<script setup lang="ts">
/**
 * DetailHeader - Consistent header for detail panels
 */
defineProps<{
	title: string;
	subtitle?: string;
}>();
</script>

<template>
  <div class="flex items-start justify-between gap-4 mb-5">
    <div class="min-w-0 flex-1">
      <h2 class="text-[20px] font-semibold tracking-tight text-[var(--text-primary)] leading-tight">
        {{ title }}
      </h2>
      <p v-if="subtitle" class="text-[12px] text-[var(--text-tertiary)] mt-1">
        {{ subtitle }}
      </p>
    </div>
    <div v-if="$slots.actions" class="flex items-center gap-1.5 shrink-0">
      <slot name="actions" />
    </div>
  </div>
</template>
