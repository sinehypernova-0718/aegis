<script setup lang="ts">
/**
 * ScopeTagInput — n8n-style tag editor for scopes/permissions.
 *
 * Type + Enter/Space/comma to add a chip; Backspace on an empty input removes
 * the last chip; pasted text is split on commas/newlines. Provider suggestions
 * render as toggleable chips below the field.
 */
import { computed, ref, useTemplateRef } from 'vue';
import { X, Plus } from 'lucide-vue-next';
import { controlBaseClass, controlStyle, focusStyle, errorStyle } from '@/components/ui/formStyles';

interface Props {
	modelValue: string[];
	suggestions?: readonly string[];
	placeholder?: string;
	error?: string | undefined;
}

const props = withDefaults(defineProps<Props>(), {
	suggestions: () => [],
	placeholder: 'Add scope and press Enter',
	error: undefined,
});

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>();

const MAX_SCOPES = 20;
const MAX_SCOPE_LENGTH = 128;

const draft = ref('');
const focused = ref(false);
const inputRef = useTemplateRef<HTMLInputElement>('input');

function commit(values: string[]): void {
	const next = [...props.modelValue];
	for (const raw of values) {
		const value = raw.trim();
		if (value.length === 0) continue;
		if (value.length > MAX_SCOPE_LENGTH) continue;
		if (next.length >= MAX_SCOPES) break;
		if (!next.includes(value)) next.push(value);
	}
	emit('update:modelValue', next);
}

function addFromInput(): void {
	if (draft.value.trim().length === 0) return;
	commit(draft.value.split(/[,\n]/));
	draft.value = '';
}

function onKeydown(e: KeyboardEvent): void {
	if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
		e.preventDefault();
		addFromInput();
		return;
	}
	if (e.key === 'Backspace' && draft.value.length === 0 && props.modelValue.length > 0) {
		e.preventDefault();
		emit('update:modelValue', props.modelValue.slice(0, -1));
	}
}

function onPaste(e: ClipboardEvent): void {
	const text = e.clipboardData?.getData('text');
	if (!text || !/[,\n]/.test(text)) return;
	e.preventDefault();
	commit(text.split(/[,\n]/));
}

function remove(value: string): void {
	emit(
		'update:modelValue',
		props.modelValue.filter((v) => v !== value),
	);
}

function toggleSuggestion(value: string): void {
	if (props.modelValue.includes(value)) {
		remove(value);
	} else {
		commit([value]);
	}
}

const fieldStyle = computed(() => ({
	...controlStyle,
	...(focused.value && !props.error ? focusStyle : {}),
	...(props.error ? errorStyle : {}),
}));

const atCapacity = computed(() => props.modelValue.length >= MAX_SCOPES);
</script>

<template>
  <div>
    <div
      class="flex flex-wrap items-center gap-1.5 px-2 py-1.5 min-h-[38px] cursor-text"
      :class="controlBaseClass"
      :style="fieldStyle"
      @click="inputRef?.focus()"
    >
      <span
        v-for="scope in modelValue"
        :key="scope"
        class="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded text-[11px] font-mono"
        :style="{
          background: 'var(--surface-tertiary)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-primary)',
        }"
      >
        {{ scope }}
        <button
          type="button"
          class="p-0.5 rounded hover:bg-[var(--surface-quaternary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          :aria-label="`Remove ${scope}`"
          @click.stop="remove(scope)"
        >
          <X :size="10" />
        </button>
      </span>

      <input
        ref="input"
        v-model="draft"
        type="text"
        class="scope-tag__input flex-1 min-w-[80px] bg-transparent outline-none border-none text-[13px] font-mono"
        :style="{ color: 'var(--text-primary)', caretColor: 'var(--accent-primary)' }"
        :placeholder="modelValue.length === 0 ? placeholder : ''"
        :disabled="atCapacity"
        @keydown="onKeydown"
        @paste="onPaste"
        @blur="focused = false; addFromInput()"
        @focus="focused = true"
      />
    </div>

    <p v-if="error" class="text-[11px] mt-1 text-[var(--danger)]">{{ error }}</p>
    <p v-else-if="atCapacity" class="text-[11px] mt-1 text-[var(--text-tertiary)]">
      Maximum of {{ MAX_SCOPES }} scopes reached.
    </p>

    <div v-if="suggestions && suggestions.length > 0" class="flex flex-wrap gap-1.5 mt-2">
      <button
        v-for="suggestion in suggestions"
        :key="suggestion"
        type="button"
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono transition-colors"
        :style="{
          background: modelValue.includes(suggestion) ? 'var(--gold-surface)' : 'var(--surface-input)',
          border: `1px solid ${modelValue.includes(suggestion) ? 'var(--gold-border)' : 'var(--border-subtle)'}`,
          color: modelValue.includes(suggestion) ? 'var(--gold)' : 'var(--text-secondary)',
        }"
        @click="toggleSuggestion(suggestion)"
      >
        <Plus v-if="!modelValue.includes(suggestion)" :size="9" />
        {{ suggestion }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/* The wrapper owns the focus treatment; suppress the global focus ring the
   inner text input would otherwise paint inside the field. */
.scope-tag__input:focus-visible {
  box-shadow: none;
  outline: none;
}
</style>
