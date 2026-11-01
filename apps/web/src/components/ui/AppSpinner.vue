<script setup lang="ts">
/** AppSpinner — token-driven loading indicator (functional rotation only). */
import { computed } from 'vue';

interface Props {
	/** Pixel size (icon-sizing convention: 12 / 15 / 16 / 20 / 24). */
	size?: number;
}

const props = withDefaults(defineProps<Props>(), { size: 16 });

const style = computed(() => ({
	width: `${props.size}px`,
	height: `${props.size}px`,
}));
</script>

<template>
  <span class="a-spinner" :style="style" role="status" aria-label="Loading" />
</template>
