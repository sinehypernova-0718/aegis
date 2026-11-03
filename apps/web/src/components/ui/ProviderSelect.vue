<script setup lang="ts">
/**
 * ProviderSelect — single "bubble" provider picker with offline logos.
 *
 * A searchable combobox (same floating-panel pattern as AppSelect) whose rows
 * carry the provider brand mark. Emits the provider id; "Other" is a normal
 * option. The panel is teleported to <body> so it can float beyond the
 * credential-form modal's scroll container.
 */
import { computed, nextTick, onUnmounted, ref, useId, useTemplateRef } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { motion, AnimatePresence } from 'motion-v';
import { ChevronDown, Search, Check } from 'lucide-vue-next';
import { durations, easings, springs } from '@/motion/tokens';
import { PROVIDERS, OTHER_PROVIDER_ID, findProviderById } from '@/services/providers';
import ProviderLogo from '@/components/ui/ProviderLogo.vue';

interface Props {
	modelValue: string;
	otherName?: string | undefined;
	placeholder?: string;
	error?: string | undefined;
}

const props = withDefaults(defineProps<Props>(), {
	otherName: undefined,
	placeholder: 'Select a provider',
	error: undefined,
});

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

interface Row {
	value: string;
	label: string;
}

const ALL_ROWS: Row[] = [
	...PROVIDERS.map((p) => ({ value: p.id, label: p.name })),
	{ value: OTHER_PROVIDER_ID, label: 'Other' },
];

const search = ref('');
const open = ref(false);
const activeIndex = ref(0);

const rows = computed(() => {
	const q = search.value.trim().toLowerCase();
	if (q.length === 0) return ALL_ROWS;
	return ALL_ROWS.filter((row) => {
		if (row.label.toLowerCase().includes(q)) return true;
		const provider = findProviderById(row.value);
		return provider?.aliases.some((a) => a.toLowerCase().includes(q)) ?? false;
	});
});

const selectedLabel = computed(() => {
	if (props.modelValue === OTHER_PROVIDER_ID) {
		return props.otherName && props.otherName.length > 0 ? props.otherName : 'Other';
	}
	return findProviderById(props.modelValue)?.name ?? '';
});

const listId = useId();
const optionId = (index: number) => `${listId}-opt-${index}`;

const triggerRef = useTemplateRef<HTMLElement>('trigger');
const panelRef = useTemplateRef<HTMLElement | ComponentPublicInstance>('panel');
const searchRef = useTemplateRef<HTMLInputElement>('searchInput');

function panelEl(): HTMLElement | null {
	const raw = panelRef.value;
	if (raw === null || raw === undefined) return null;
	if (raw instanceof HTMLElement) return raw;
	const node = (raw as ComponentPublicInstance).$el;
	return node instanceof HTMLElement ? node : null;
}

const PANEL_GAP = 6;
const PANEL_MAX_HEIGHT = 320;

const panelStyle = ref<Record<string, string>>({});

function positionPanel(): void {
	const trigger = triggerRef.value;
	if (!trigger) return;
	const rect = trigger.getBoundingClientRect();
	const measured = panelEl()?.offsetHeight;
	const panelHeight = measured ?? Math.min(PANEL_MAX_HEIGHT, 320);
	const spaceBelow = window.innerHeight - rect.bottom;
	const top =
		spaceBelow >= panelHeight + PANEL_GAP
			? rect.bottom + PANEL_GAP
			: Math.max(PANEL_GAP, rect.top - panelHeight - PANEL_GAP);
	const left = Math.max(PANEL_GAP, Math.min(rect.left, window.innerWidth - rect.width - PANEL_GAP));
	panelStyle.value = {
		position: 'fixed',
		top: `${top}px`,
		left: `${left}px`,
		width: `${rect.width}px`,
	};
}

function setOpen(value: boolean): void {
	if (open.value === value) return;
	open.value = value;
	if (value) {
		search.value = '';
		const current = rows.value.findIndex((r) => r.value === props.modelValue);
		activeIndex.value = current >= 0 ? current : 0;
		void nextTick(() => {
			positionPanel();
			searchRef.value?.focus();
		});
	}
}

function commit(index: number): void {
	const row = rows.value[index];
	if (!row) return;
	emit('update:modelValue', row.value);
	setOpen(false);
}

function move(delta: 1 | -1): void {
	const count = rows.value.length;
	if (count === 0) return;
	activeIndex.value = (activeIndex.value + delta + count) % count;
}

function onSearchKeydown(e: KeyboardEvent): void {
	if (e.key === 'ArrowDown') {
		e.preventDefault();
		move(1);
	} else if (e.key === 'ArrowUp') {
		e.preventDefault();
		move(-1);
	} else if (e.key === 'Enter') {
		e.preventDefault();
		commit(activeIndex.value);
	} else if (e.key === 'Escape') {
		e.preventDefault();
		setOpen(false);
	}
}

function onDocPointer(e: PointerEvent): void {
	if (!open.value) return;
	const target = e.target as Element | null;
	if (!target) return;
	if (triggerRef.value?.contains(target) || panelEl()?.contains(target)) return;
	setOpen(false);
}

function onReflow(): void {
	if (open.value) positionPanel();
}

document.addEventListener('pointerdown', onDocPointer);
document.addEventListener('scroll', onReflow, true);
window.addEventListener('resize', onReflow);

onUnmounted(() => {
	document.removeEventListener('pointerdown', onDocPointer);
	document.removeEventListener('scroll', onReflow, true);
	window.removeEventListener('resize', onReflow);
});
</script>

<template>
  <div class="provider-select">
    <button
      ref="trigger"
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="open ? listId : undefined"
      class="provider-select__trigger"
      :class="{ 'provider-select__trigger--error': error !== undefined }"
      @click="setOpen(!open)"
      @keydown.down.prevent="setOpen(true)"
    >
      <span class="provider-select__value">
        <template v-if="modelValue">
          <ProviderLogo :provider-id="modelValue" :name="selectedLabel" :size="18" />
          <span class="provider-select__label">{{ selectedLabel }}</span>
        </template>
        <span v-else class="provider-select__placeholder">{{ placeholder }}</span>
      </span>
      <ChevronDown :size="14" class="provider-select__chevron" :class="{ 'provider-select__chevron--open': open }" />
    </button>

    <Teleport to="body">
      <AnimatePresence>
        <motion.div
          v-if="open"
          ref="panel"
          :id="listId"
          role="listbox"
          :initial="{ opacity: 0, scale: 0.97, y: -6 }"
          :animate="{ opacity: 1, scale: 1, y: 0, transition: { ...springs.snappy, opacity: { duration: durations.micro, ease: easings.out } } }"
          :exit="{ opacity: 0, scale: 0.97, y: -4, transition: { duration: durations.micro, ease: easings.in } }"
          class="a-glass a-glass--float provider-select__panel"
          :style="panelStyle"
        >
          <div class="provider-select__search">
            <Search :size="13" class="provider-select__search-icon" />
            <input
              ref="searchInput"
              v-model="search"
              type="text"
              placeholder="Search providers..."
              class="provider-select__search-input"
              @keydown="onSearchKeydown"
            />
          </div>
          <ul class="provider-select__list">
            <li
              v-for="(row, i) in rows"
              :key="row.value"
              :id="optionId(i)"
              role="option"
              :aria-selected="row.value === modelValue"
              class="provider-select__option"
              :class="{
                'provider-select__option--active': i === activeIndex,
                'provider-select__option--selected': row.value === modelValue,
              }"
              @mouseenter="activeIndex = i"
              @click="commit(i)"
            >
              <ProviderLogo :provider-id="row.value" :name="row.label" :size="18" />
              <span class="provider-select__option-label">{{ row.label }}</span>
              <Check v-if="row.value === modelValue" :size="14" class="provider-select__check" />
            </li>
            <li v-if="rows.length === 0" class="provider-select__empty">No matching provider</li>
          </ul>
        </motion.div>
      </AnimatePresence>
    </Teleport>
  </div>
</template>

<style scoped>
.provider-select {
  display: inline-flex;
  position: relative;
  width: 100%;
}

.provider-select__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  min-width: 0;
  text-align: left;
  font-size: 13px;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid var(--border-default);
  background: var(--surface-input);
  color: var(--text-primary);
  box-shadow: var(--specular-rim-subtle), var(--shadow-xs);
  cursor: pointer;
  transition:
    background var(--duration-control) var(--ease-out),
    border-color var(--duration-control) var(--ease-out),
    box-shadow var(--duration-control) var(--ease-out);
}
.provider-select__trigger:hover {
  border-color: var(--border-strong);
  box-shadow: var(--specular-rim-subtle), var(--shadow-sm);
}
.provider-select__trigger:focus-visible {
  border-color: var(--border-focus);
  background: var(--surface-primary);
  box-shadow: var(--focus-ring-glow), var(--specular-rim-subtle);
  outline: none;
}
.provider-select__trigger[aria-expanded='true'] {
  border-color: var(--border-focus);
  box-shadow: var(--specular-rim-subtle), var(--shadow-md);
}
.provider-select__trigger--error {
  border-color: var(--danger);
  box-shadow: 0 0 0 3px var(--danger-muted), var(--specular-rim-subtle);
}

.provider-select__value {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1 1 auto;
  min-width: 0;
}
.provider-select__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.provider-select__placeholder {
  color: var(--text-tertiary);
}
.provider-select__chevron {
  flex: 0 0 auto;
  color: var(--text-tertiary);
  transition: transform var(--duration-control) var(--ease-out);
}
.provider-select__chevron--open {
  transform: rotate(180deg);
}

.provider-select__panel {
  padding: 0.375rem;
  border-radius: var(--radius-lg);
  z-index: 70;
  max-height: 320px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.provider-select__search {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.5rem;
  margin-bottom: 0.25rem;
  border-bottom: 1px solid var(--border-subtle);
}
.provider-select__search-icon {
  color: var(--text-tertiary);
  flex: 0 0 auto;
}
.provider-select__search-input {
  flex: 1 1 auto;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  font-size: 13px;
  color: var(--text-primary);
}
.provider-select__search-input:focus-visible {
  box-shadow: none;
  outline: none;
}

.provider-select__list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}
.provider-select__option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background var(--duration-control) var(--ease-out), color var(--duration-control) var(--ease-out);
}
.provider-select__option--active {
  background: var(--surface-tertiary);
  color: var(--text-primary);
}
.provider-select__option--selected {
  color: var(--text-primary);
}
.provider-select__option-label {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.provider-select__check {
  flex: 0 0 auto;
  color: var(--accent-primary);
}
.provider-select__empty {
  padding: 0.5rem;
  font-size: 12px;
  color: var(--text-tertiary);
}
</style>
