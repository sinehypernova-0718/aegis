<script setup lang="ts">
/**
 * AppDateInput — themed native date input.
 *
 * The native calendar popover is OS chrome that cannot be re-skinned; what we
 * CAN theme is the control itself. The input surface is pulled into the same
 * frosted glass family as AppSelect ("cloudy" `backdrop-filter` on the Aegis
 * glass background instead of the flat input surface), while the popup colors
 * follow the active theme through the `[data-theme]` `color-scheme` rules in
 * global.css (the Chromium calendar picker reads `color-scheme`).
 *
 * API mirrors AppInput (minus autocomplete/placeholder extras).
 */
import { computed, ref } from 'vue';
import {
	controlBaseClass,
	controlSizeClasses,
	controlStyle,
	disabledStyle,
	errorStyle,
	focusStyle,
	type ControlSize,
} from './formStyles';

interface Props {
	modelValue?: string;
	size?: ControlSize;
	disabled?: boolean;
	error?: string | undefined;
	id?: string;
	ariaLabel?: string | undefined;
}

const props = withDefaults(defineProps<Props>(), {
	modelValue: '',
	size: 'md',
	disabled: false,
});

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const fallbackId = `date-${Math.random().toString(36).slice(2, 9)}`;
const inputId = computed(() => props.id ?? fallbackId);
const focused = ref(false);
const inputEl = ref<HTMLInputElement | null>(null);

defineExpose({
	focus: () => inputEl.value?.focus(),
	blur: () => inputEl.value?.blur(),
});

const classes = computed(() => `${controlBaseClass} ${controlSizeClasses[props.size]}`);

// formStyles values compose with the scoped glass class below; the background
// stays in CSS so the inline style never shadows the frosted surface.
const style = computed(() => ({
	borderColor: controlStyle.borderColor,
	color: controlStyle.color,
	boxShadow: controlStyle.boxShadow,
	...(focused.value && !props.error && !props.disabled ? focusStyle : {}),
	...(props.error ? errorStyle : {}),
	...(props.disabled ? disabledStyle : {}),
}));
</script>

<template>
	<div class="w-full">
		<input
			:id="inputId"
			ref="inputEl"
			type="date"
			:class="[classes, 'a-date-input']"
			:style="style"
			:value="modelValue"
			:disabled="disabled"
			:aria-label="ariaLabel"
			:aria-invalid="error ? true : undefined"
			@input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
			@focus="focused = true"
			@blur="focused = false"
		/>
		<p v-if="error" :id="`${inputId}-error`" class="mt-1 text-[11px]" :style="{ color: 'var(--danger)' }">
			{{ error }}
		</p>
	</div>
</template>

<style scoped>
/* Same surface as the sibling inputs (formStyles.controlStyle); the frosted
   treatment belongs to the open panel, the calendar popup (color-scheme) and
   the trigger's specular rim/light-lift interactions. */
.a-date-input {
	background: var(--surface-input);
	/* Uniform control typography — matches the sibling 13px inputs exactly. */
	font-size: 13px;
}

.a-date-input:hover:not(:disabled):not(:focus) {
	border-color: var(--border-strong);
}

/* Calendar toggle: quiet by default, full contrast on hover. */
.a-date-input::-webkit-calendar-picker-indicator {
	opacity: 0.6;
	cursor: pointer;
	transition: opacity var(--duration-control) var(--ease-out);
}
.a-date-input::-webkit-calendar-picker-indicator:hover {
	opacity: 1;
}
</style>
