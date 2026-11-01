<script setup lang="ts">
/**
 * KeyValue - Consistent key-value pair display
 */
defineProps<{
	label: string;
}>();
</script>

<template>
  <div class="flex items-center justify-between">
    <span class="text-[11px] text-[var(--text-secondary)]">{{ label }}</span>
    <slot />
  </div>
</template>
