<script setup lang="ts">
/**
 * GlassPanel — the core glassmorphism surface primitive.
 *
 * Thin wrapper over the `.a-glass` CSS tiers in global.css so depth, blur,
 * border, highlight and shadow are defined exactly once (in tokens/CSS) and
 * never re-derived per component. All visual values come from semantic
 * tokens; nothing here hardcodes a color.
 */
import { computed } from 'vue';

type GlassDepth = 'subtle' | 'standard' | 'elevated' | 'modal' | 'focused';

interface Props {
	/** Visual depth tier. */
	depth?: GlassDepth;
	/** Golden border/glow variant — reserved for premium highlights only. */
	gold?: boolean;
	/** Optional radius override token (e.g. var(--radius-xl)). */
	radius?: string;
	/** Internal padding as a CSS value; defaults to none (caller lays out). */
	padding?: string;
	as?: string;
}

const props = withDefaults(defineProps<Props>(), {
	depth: 'standard',
	gold: false,
	as: 'div',
});

const classes = computed(() => [
	'a-glass',
	`a-glass--${props.depth}`,
	props.gold ? 'a-glass--gold' : '',
]);

const style = computed(() => ({
	...(props.radius ? { borderRadius: props.radius } : {}),
	...(props.padding ? { padding: props.padding } : {}),
}));
</script>

<template>
  <component :is="as" :class="classes" :style="style">
    <slot />
  </component>
</template>
