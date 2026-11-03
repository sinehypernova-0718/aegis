<script setup lang="ts">
/**
 * ProviderLogo — offline, theme-aware brand mark for a provider.
 *
 * Logos are bundled SVGs rendered inline (no network). Monochrome dark glyphs
 * are recolored to the current text color so they read correctly on both the
 * light and dark themes; multicolor marks sit on a neutral plate so their dark
 * parts stay visible in dark mode. Providers without a shipped mark (e.g.
 * "Other") fall back to a deterministic monogram avatar.
 */
import { computed } from 'vue';
import { providerMark, providerMonogram } from '@/services/providers';

interface Props {
	providerId?: string | undefined;
	name?: string | undefined;
	size?: number;
	rounded?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	providerId: undefined,
	name: undefined,
	size: 20,
	rounded: true,
});

const mark = computed(() => providerMark(props.providerId));

const monogram = computed(() => providerMonogram(props.name ?? props.providerId ?? '?'));

const boxStyle = computed(() => ({
	width: `${props.size}px`,
	height: `${props.size}px`,
	borderRadius: props.rounded ? '5px' : '0',
	background: mark.value?.plate ? '#ffffff' : 'transparent',
	border: mark.value?.plate ? '1px solid rgba(0, 0, 0, 0.08)' : 'none',
}));

const innerStyle = computed(() => ({
	color: mark.value?.adaptive ? 'var(--text-primary)' : undefined,
}));

const monogramStyle = computed(() => {
	const { hue } = monogram.value;
	return {
		width: `${props.size}px`,
		height: `${props.size}px`,
		borderRadius: props.rounded ? '5px' : '0',
		background: `linear-gradient(135deg, hsl(${hue} 62% 46%), hsl(${(hue + 40) % 360} 62% 36%))`,
		color: '#fff',
		fontSize: `${Math.round(props.size * 0.44)}px`,
		letterSpacing: '-0.02em',
	};
});
</script>

<template>
  <span
    v-if="mark"
    class="provider-logo inline-flex items-center justify-center shrink-0 overflow-hidden"
    :style="boxStyle"
    :aria-label="name ?? providerId ?? 'provider'"
    role="img"
  >
    <!-- eslint-disable-next-line vue/no-v-html -- trusted, build-time bundled SVG -->
    <span
      class="provider-logo__inner"
      :class="{ 'provider-logo__inner--plate': mark.plate }"
      :style="innerStyle"
      v-html="mark.html"
    />
  </span>
  <span
    v-else
    class="provider-logo-mono inline-flex items-center justify-center font-semibold shrink-0 select-none"
    :style="monogramStyle"
    :aria-label="name ?? providerId ?? 'provider'"
    role="img"
  >
    {{ monogram.initials }}
  </span>
</template>

<style scoped>
.provider-logo__inner {
  display: block;
  width: 100%;
  height: 100%;
  padding: 12%;
  box-sizing: border-box;
}
.provider-logo__inner--plate {
  padding: 7%;
}
.provider-logo__inner :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}
.provider-logo-mono {
  line-height: 1;
}
</style>
