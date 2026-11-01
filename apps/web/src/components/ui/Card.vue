<script setup lang="ts">
/**
 * Card — Consistent card surface with glassmorphism, physical elevation, and optional golden accentuation.
 */
import { computed } from 'vue';

interface Props {
	padding?: 'none' | 'sm' | 'md' | 'lg';
	variant?: 'standard' | 'elevated' | 'glass' | 'gold';
	interactive?: boolean;
	gold?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	padding: 'sm',
	variant: 'standard',
	interactive: false,
	gold: false,
});

const isGold = computed(() => props.gold || props.variant === 'gold');

const classes = computed(() => {
	const paddings = {
		none: 'p-0',
		sm: 'p-3.5',
		md: 'p-5',
		lg: 'p-6',
	};

	const variants = {
		standard: 'a-glass a-glass--standard',
		elevated: 'a-glass a-glass--elevated',
		glass: 'a-glass a-glass--subtle',
		gold: 'a-glass a-glass--gold',
	};

	return [
		'rounded-lg relative transition-all duration-200',
		variants[props.variant],
		isGold.value ? 'a-glass--gold' : '',
		props.interactive ? 'a-glass--interactive cursor-pointer' : '',
		paddings[props.padding],
	];
});
</script>

<template>
  <div :class="classes">
    <slot />
  </div>
</template>
