<script setup lang="ts">
/**
 * AppPasswordInput — masked-input VISUAL PRIMITIVE.
 *
 * The eye toggle is local display state (type=password ⇄ text); it performs
 * no encryption, reveal-from-vault, or copy behavior.
 */
import { computed, ref } from 'vue';
import { Eye, EyeOff } from 'lucide-vue-next';
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
	autocomplete?: string;
	autofocus?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	modelValue: '',
	size: 'md',
	disabled: false,
	autocomplete: 'off',
	autofocus: false,
});

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const fallbackId = `pw-${Math.random().toString(36).slice(2, 9)}`;
const inputId = computed(() => props.id ?? fallbackId);
const focused = ref(false);
const revealed = ref(false);
const inputEl = ref<HTMLInputElement | null>(null);

defineExpose({
	focus: () => inputEl.value?.focus(),
	blur: () => inputEl.value?.blur(),
});

const classes = computed(() => `${controlBaseClass} ${controlSizeClasses[props.size]} pr-10`);
const style = computed(() => ({
	...controlStyle,
	...(focused.value && !props.error && !props.disabled ? focusStyle : {}),
	...(props.error ? errorStyle : {}),
	...(props.disabled ? disabledStyle : {}),
}));
</script>

<template>
  <div class="w-full">
    <label v-if="label" :for="inputId" class="a-label block mb-1.5">{{ label }}</label>
    <div class="relative">
      <input
        :id="inputId"
        ref="inputEl"
        :class="classes"
        :style="style"
        :type="revealed ? 'text' : 'password'"
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
      <button
        type="button"
        class="absolute inset-y-0 right-0 flex items-center pr-2.5 pl-1 rounded-r-md outline-none cursor-pointer"
        :style="{ color: revealed ? 'var(--accent-primary)' : 'var(--text-tertiary)' }"
        :aria-label="revealed ? 'Hide value' : 'Show value'"
        :aria-pressed="revealed"
        :disabled="disabled"
        @click="revealed = !revealed"
      >
        <component :is="revealed ? EyeOff : Eye" :size="15" />
      </button>
    </div>
    <p v-if="error" :id="`${inputId}-error`" class="mt-1 text-[11px]" :style="{ color: 'var(--danger)' }">{{ error }}</p>
  </div>
</template>

<style scoped>
input::placeholder {
  color: var(--text-disabled);
  opacity: 1;
}
input:hover:not(:disabled):not(:focus) {
  border-color: var(--border-strong);
}
button:focus-visible {
  box-shadow: var(--focus-ring-glow);
}
</style>
