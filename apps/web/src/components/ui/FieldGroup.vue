<script setup lang="ts">
/**
 * FieldGroup - Consistent field label and value presentation
 */
defineProps<{
	label: string;
}>();
</script>

<template>
  <div class="space-y-1.5">
    <label class="text-[10px] font-medium tracking-wider uppercase text-[var(--text-tertiary)]">
      {{ label }}
    </label>
    <slot />
  </div>
</template>
