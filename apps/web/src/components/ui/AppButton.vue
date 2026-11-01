<script setup lang="ts">
/**
 * AppButton — action primitive.
 * Variants: primary (gradient accent) · secondary · danger · ghost ·
 * glass (translucent surface tier) · gold (restrained premium accent).
 * All colors resolve through semantic tokens; hover/press come from the
 * centralized buttonInteraction preset and collapse under reduced motion.
 */
import { computed } from 'vue';
import { motion } from 'motion-v';
import { Loader2 } from 'lucide-vue-next';
import { buttonInteraction } from '@/motion/presets';
import { useAppReducedMotion } from '@/motion/composables/useReducedMotion';

interface Props {
	variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'glass' | 'gold';
	size?: 'sm' | 'md' | 'lg';
	type?: 'button' | 'submit' | 'reset';
	loading?: boolean;
	disabled?: boolean;
}

const { reduced } = useAppReducedMotion();

const props = withDefaults(defineProps<Props>(), {
	variant: 'secondary',
	size: 'md',
	type: 'button',
	loading: false,
	disabled: false,
});

const styles = computed(() => {
	const base =
		'inline-flex items-center justify-center gap-1.5 font-medium rounded-md transition-all outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)] active:translate-y-px active:shadow-none select-none';

	const variants = {
		primary: {
			background: 'var(--gradient-accent)',
			color: 'var(--text-on-accent)',
			border: '1px solid var(--accent-border)',
			boxShadow: 'var(--specular-rim), var(--shadow-sm), var(--shadow-accent)',
		},
		secondary: {
			background: 'var(--surface-secondary)',
			color: 'var(--text-secondary)',
			border: '1px solid var(--border-default)',
			boxShadow: 'var(--specular-rim), var(--shadow-xs)',
		},
		danger: {
			background: 'var(--danger-muted)',
			color: 'var(--danger)',
			border: '1px solid rgba(248, 113, 113, 0.35)',
			boxShadow: 'var(--specular-rim-subtle), var(--shadow-xs)',
		},
		ghost: {
			background: 'transparent',
			color: 'var(--text-secondary)',
			border: '1px solid transparent',
			boxShadow: 'none',
		},
		// Glass tier — depth comes from the shared .a-glass CSS recipe.
		glass: {
			color: 'var(--text-primary)',
			border: '1px solid var(--glass-border)',
			boxShadow: 'var(--specular-rim-subtle), var(--shadow-xs)',
		},
		gold: {
			background: 'var(--gradient-gold)',
			color: 'var(--text-on-gold)',
			border: '1px solid var(--gold-border)',
			boxShadow: 'var(--specular-rim-gold), var(--shadow-gold-elevated)',
		},
	};

	const focusRings = {
		primary: 'focus-visible:ring-[var(--accent-primary)]',
		secondary: 'focus-visible:ring-[var(--accent-primary)]',
		danger: 'focus-visible:ring-[var(--danger)]',
		ghost: 'focus-visible:ring-[var(--accent-primary)]',
		glass: 'focus-visible:ring-[var(--accent-primary)]',
		gold: 'focus-visible:ring-[var(--gold-border-focus)]',
	};

	const sizes = {
		sm: 'px-2.5 py-1.5 text-[11px] font-semibold',
		md: 'px-3.5 py-2 text-[12px] font-semibold',
		lg: 'px-4.5 py-2.5 text-[13px] font-semibold',
	};

	return {
		class: `${base} ${props.variant === 'glass' ? 'a-glass a-glass--subtle' : ''} ${sizes[props.size]} ${focusRings[props.variant]}`,
		style: {
			...variants[props.variant],
			opacity: props.disabled || props.loading ? 0.5 : 1,
			cursor: props.disabled || props.loading ? 'not-allowed' : 'pointer',
		},
	};
});
</script>

<template>
  <motion.button
    :type="type"
    :class="styles.class"
    :style="styles.style"
    :disabled="disabled || loading"
    v-bind="reduced || disabled || loading ? {} : buttonInteraction"
  >
    <Loader2 v-if="loading" :size="size === 'lg' ? 14 : 12" class="animate-spin" />
    <slot />
  </motion.button>
</template>
