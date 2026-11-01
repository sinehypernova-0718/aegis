<script setup lang="ts">
/**
 * DetailContainer - Consistent container for detail panel content
 */
withDefaults(
	defineProps<{
		maxWidth?: string;
	}>(),
	{
		maxWidth: '680px',
	},
);
</script>

<template>
  <div class="h-full flex items-start justify-center px-8 py-6">
    <div class="w-full" :style="{ maxWidth }">
      <slot />
    </div>
  </div>
</template>
