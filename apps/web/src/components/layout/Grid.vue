<script setup lang="ts">
/**
 * Grid — responsive grid layout primitive.
 *
 * When `cols` is a number ≤ 4 the grid uses enumerated Tailwind responsive
 * breakpoints so the layout degrades gracefully on narrow viewports:
 *   cols=1 → always 1 column
 *   cols=2 → 1 col on mobile, 2 on sm+
 *   cols=3 → 1 col on mobile, 2 on sm+, 3 on lg+
 *   cols=4 → 1 col on mobile, 2 on sm+, 4 on xl+
 *
 * For arbitrary numeric counts (> 4) Tailwind cannot reliably see classes
 * like `lg:grid-cols-5` (they don't exist verbatim in source, so the JIT
 * scanner never generates them). Those counts instead use the
 * `.grid-cols-arbitrary` scoped rule driven by a CSS custom property, which
 * reproduces the same responsive ramp (2 columns ≥ sm, N columns ≥ lg)
 * without depending on dynamic class-name generation.
 *
 * A string value is passed through to gridTemplateColumns unchanged (for
 * explicit advanced layouts).
 */
import { computed } from 'vue';

const props = withDefaults(
	defineProps<{
		cols?: number | string;
		gap?: 'sm' | 'md' | 'lg';
	}>(),
	{ cols: 1 },
);

const BREAKPOINT_TARGET = 4; // Largest count covered by enumerated classes.

/** Whether the arbitrary-CSS-var path is needed. */
const arbitrary = computed(() => typeof props.cols === 'number' && props.cols > BREAKPOINT_TARGET);

/** Enumerated responsive classes for the common 1–4 column counts. */
const responsiveColsClass = computed<string>(() => {
	if (arbitrary.value || typeof props.cols !== 'number') return '';
	switch (props.cols) {
		case 1:
			return 'grid-cols-1';
		case 2:
			return 'grid-cols-1 sm:grid-cols-2';
		case 3:
			return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
		case 4:
			return 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4';
		default:
			return 'grid-cols-1 sm:grid-cols-2';
	}
});

/**
 * Inline styles:
 *  - string cols → explicit gridTemplateColumns expression.
 *  - arbitrary numeric cols → `--grid-cols-target` feeds the scoped
 *    media-query rule below (repeat() accepts an integer custom property).
 */
const inlineStyle = computed(() => {
	if (typeof props.cols === 'string') {
		return { gridTemplateColumns: props.cols };
	}
	if (arbitrary.value) {
		return { '--grid-cols-target': String(props.cols) } as Record<string, string>;
	}
	return {};
});
</script>

<template>
  <div
    class="grid"
    :class="[
      responsiveColsClass,
      { 'grid-cols-arbitrary': arbitrary },
      {
        'gap-2': gap === 'sm' || !gap,
        'gap-3': gap === 'md',
        'gap-4': gap === 'lg',
      },
    ]"
    :style="inlineStyle"
  >
    <slot />
  </div>
</template>

<style scoped>
/* Arbitrary numeric column counts (cols > 4): responsive ramp via CSS custom
   property — no dynamically-constructed Tailwind class names involved. */
.grid-cols-arbitrary {
  grid-template-columns: repeat(1, minmax(0, 1fr));
}
@media (min-width: 640px) {
  .grid-cols-arbitrary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (min-width: 1024px) {
  .grid-cols-arbitrary {
    grid-template-columns: repeat(var(--grid-cols-target, 1), minmax(0, 1fr));
  }
}
</style>
