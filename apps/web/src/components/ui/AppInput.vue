<script setup lang="ts">
/** AppInput — text-form control visual primitive (no validation logic). */
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
	label?: string;
	placeholder?: string;
	size?: ControlSize;
	disabled?: boolean;
	error?: string | undefined;
	id?: string;
	type?: string;
	autocomplete?: string;
	autofocus?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	modelValue: '',
	size: 'md',
	disabled: false,
	type: 'text',
	autocomplete: 'off',
	autofocus: false,
});

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const fallbackId = `input-${Math.random().toString(36).slice(2, 9)}`;
const inputId = computed(() => props.id ?? fallbackId);
const focused = ref(false);
const inputEl = ref<HTMLInputElement | null>(null);

defineExpose({
	focus: () => inputEl.value?.focus(),
	blur: () => inputEl.value?.blur(),
});

const classes = computed(() => `${controlBaseClass} ${controlSizeClasses[props.size]}`);
const style = computed(() => ({
	...controlStyle,
	...(focused.value && !props.error && !props.disabled ? focusStyle : {}),
	...(props.error ? errorStyle : {}),
	...(props.disabled ? disabledStyle : {}),
}));
</script>

<template>
  <div class="w-full">
    <label
      v-if="label"
      :for="inputId"
      class="a-label block mb-1.5"
    >{{ label }}</label>
    <input
      :id="inputId"
      ref="inputEl"
      :type="type"
      :class="classes"
      :style="style"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :autofocus="autofocus"
      :autocomplete="autocomplete"
      :aria-invalid="error ? true : undefined"
      :aria-describedby="error ? `${inputId}-error` : undefined"
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
/* Token-driven placeholder color (scoped to this control only). */
input::placeholder {
  color: var(--text-disabled);
  opacity: 1;
}
input:hover:not(:disabled):not(:focus) {
  border-color: var(--border-strong);
}
</style>
