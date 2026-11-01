<script setup lang="ts">
/**
 * AppSelect — theme-native select control.
 *
 * Replaces native <select> elements so the open list renders inside the Aegis
 * glass system (`a-glass--float`: frosted, layered-shadow "floating in air"
 * panel) instead of the OS-default chrome.
 *
 * Accessibility follows the select-only combobox pattern (WAI-ARIA APG): the
 * trigger is a real <button> carrying aria-haspopup/expanded/controls and
 * aria-activedescendant; the panel is a `role="listbox"` of `role="option"`
 * rows. Arrow keys move highlight through committed state without closing,
 * Home/End jump, Enter/Space commit, Escape closes without losing focus,
 * Tab closes and moves on, and typing performs typeahead.
 *
 * The panel is teleported to <body> and positioned with `fixed` so it can
 * float beyond parent scroll containers (e.g. the credential form modal)
 * without being clipped. It repositions on scroll/resize and flips above the
 * trigger when there is not enough viewport room below.
 */
import { computed, nextTick, onUnmounted, ref, useId, useTemplateRef } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { motion, AnimatePresence } from 'motion-v';
import { ChevronDown, Check } from 'lucide-vue-next';
import { durations, easings, springs } from '@/motion/tokens';
import { controlBaseClass, controlSizeClasses, type ControlSize } from './formStyles';

export interface AppSelectOption {
	value: string;
	label: string;
}

/** Options accept plain strings (label === value) or explicit pairs. */
type AppSelectInput = AppSelectOption | string;

interface Props {
	modelValue: string;
	options: readonly AppSelectInput[];
	size?: ControlSize;
	disabled?: boolean;
	error?: string | undefined;
	id?: string | undefined;
	ariaLabel?: string | undefined;
}

const props = withDefaults(defineProps<Props>(), {
	size: 'md',
	disabled: false,
	error: undefined,
	id: undefined,
	ariaLabel: undefined,
});

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const normalized = computed(() =>
	props.options.map((option) =>
		typeof option === 'string' ? { value: option, label: option } : option,
	),
);

const selectedLabel = computed(() => {
	const current = normalized.value.find((option) => option.value === props.modelValue);
	return current?.label ?? props.modelValue;
});

const listId = useId();
const optionId = (index: number) => `${listId}-opt-${index}`;

const open = ref(false);
const activeIndex = ref(0);

const triggerRef = useTemplateRef<HTMLElement>('trigger');
// motion.div hands back its component instance, not the underlying element —
// resolve the real root node for geometry/hit-testing.
const panelRef = useTemplateRef<HTMLElement | ComponentPublicInstance>('panel');

function panelEl(): HTMLElement | null {
	const raw = panelRef.value;
	if (raw === null || raw === undefined) return null;
	if (raw instanceof HTMLElement) return raw;
	const node = (raw as ComponentPublicInstance).$el;
	return node instanceof HTMLElement ? node : null;
}

/** Vertical gap between trigger and panel and the viewport margin. */
const PANEL_GAP = 6;
/** Panel height cap; rows scroll inside this budget. */
const PANEL_MAX_HEIGHT = 288;
/** Rough row height used for flip math before the panel has rendered. */
const ESTIMATED_ROW_HEIGHT = 34;

const panelStyle = ref<Record<string, string>>({});

function estimatePanelHeight(): number {
	return Math.min(normalized.value.length * ESTIMATED_ROW_HEIGHT + 12, PANEL_MAX_HEIGHT);
}

function positionPanel(): void {
	const trigger = triggerRef.value;
	if (!trigger) return;
	const rect = trigger.getBoundingClientRect();
	const measured = panelEl()?.offsetHeight;
	const panelHeight = measured ?? estimatePanelHeight();
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

function scrollActiveIntoView(): void {
	void nextTick(() => {
		const el = panelEl()?.querySelector<HTMLElement>(`#${optionId(activeIndex.value)}`);
		el?.scrollIntoView({ block: 'nearest' });
	});
}

function setOpen(value: boolean): void {
	if (open.value === value) return;
	open.value = value;
	if (value) {
		const current = normalized.value.findIndex((option) => option.value === props.modelValue);
		activeIndex.value = current >= 0 ? current : 0;
		void nextTick(positionPanel);
		scrollActiveIntoView();
	}
}

function commit(index: number): void {
	const option = normalized.value[index];
	if (!option) return;
	emit('update:modelValue', option.value);
	open.value = false;
}

function move(delta: 1 | -1): void {
	const count = normalized.value.length;
	if (count === 0) return;
	activeIndex.value = (activeIndex.value + delta + count) % count;
	scrollActiveIntoView();
}

function onTriggerKeydown(e: KeyboardEvent): void {
	if (props.disabled) return;
	const count = normalized.value.length;
	if (count === 0) return;
	if (!open.value) {
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			setOpen(true);
		}
		return;
	}
	switch (e.key) {
		case 'ArrowDown':
			e.preventDefault();
			move(1);
			break;
		case 'ArrowUp':
			e.preventDefault();
			move(-1);
			break;
		case 'Home':
			e.preventDefault();
			activeIndex.value = 0;
			scrollActiveIntoView();
			break;
		case 'End':
			e.preventDefault();
			activeIndex.value = count - 1;
			scrollActiveIntoView();
			break;
		case 'Enter':
		case ' ':
			e.preventDefault();
			commit(activeIndex.value);
			break;
		case 'Escape':
			e.preventDefault();
			// Focus stays on the trigger — no focus return juggling needed.
			open.value = false;
			break;
		case 'Tab':
			// Let the browser move focus; close without repositioning focus.
			open.value = false;
			break;
		default:
			typeahead(e);
	}
}

/**
 * Typeahead: printable characters jump the highlight to the next option
 * whose label starts with the buffered prefix. A single character re-cycles
 * through the matches from the current position; accumulating characters
 * searches from the top.
 */
let typeBuffer = '';
let typeBufferTimer: ReturnType<typeof setTimeout> | undefined;

function typeahead(e: KeyboardEvent): void {
	if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
	typeBuffer += e.key.toLowerCase();
	window.clearTimeout(typeBufferTimer);
	typeBufferTimer = setTimeout(() => {
		typeBuffer = '';
	}, 500);

	const start = typeBuffer.length === 1 ? activeIndex.value + 1 : 0;
	const count = normalized.value.length;
	for (let step = 0; step < count; step += 1) {
		const index = (start + step) % count;
		const option = normalized.value[index];
		if (option && option.label.toLowerCase().startsWith(typeBuffer)) {
			activeIndex.value = index;
			scrollActiveIntoView();
			return;
		}
	}
}

function onDocPointer(e: PointerEvent): void {
	if (!open.value) return;
	const target = e.target as Element | null;
	if (!target) return;
	if (triggerRef.value?.contains(target) || panelEl()?.contains(target)) return;
	open.value = false;
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
	window.clearTimeout(typeBufferTimer);
});
</script>

<template>
	<div class="a-select">
		<button
			:id="id"
			ref="trigger"
			type="button"
			role="combobox"
			:aria-expanded="open"
			aria-haspopup="listbox"
			:aria-controls="open ? listId : undefined"
			:aria-activedescendant="open ? optionId(activeIndex) : undefined"
			:aria-label="ariaLabel"
			:disabled="disabled"
			class="a-select__trigger"
			:class="[`a-select--${size}`, { 'a-select__trigger--error': error !== undefined }]"
			@click="open ? setOpen(false) : setOpen(true)"
			@keydown="onTriggerKeydown"
		>
			<span class="a-select__value">{{ selectedLabel }}</span>
			<ChevronDown :size="14" class="a-select__chevron" :class="{ 'a-select__chevron--open': open }" />
		</button>

		<!-- Teleported so the panel can float beyond scroll containers (the
		     credential form modal clips static panels); `fixed` + measured
		     trigger rect keeps it pinned to the trigger while scrolling. -->
		<Teleport to="body">
			<AnimatePresence>
				<motion.div
					v-if="open"
					ref="panel"
					:id="listId"
					role="listbox"
					aria-labelledby="id"
					:initial="{ opacity: 0, scale: 0.95, y: -6 }"
					:animate="{ opacity: 1, scale: 1, y: 0, transition: { ...springs.snappy, opacity: { duration: durations.micro, ease: easings.out } } }"
					:exit="{ opacity: 0, scale: 0.97, y: -4, transition: { duration: durations.micro, ease: easings.in } }"
					class="a-glass a-glass--float a-select__panel"
					:style="panelStyle"
				>
					<ul class="a-select__list">
						<li
							v-for="(opt, i) in normalized"
							:key="opt.value"
							:id="optionId(i)"
							role="option"
							:aria-selected="opt.value === modelValue"
							class="a-select__option"
							:class="{
								'a-select__option--active': i === activeIndex,
								'a-select__option--selected': opt.value === modelValue,
							}"
							@mouseenter="activeIndex = i"
							@click="commit(i)"
						>
							<span class="a-select__option-label">{{ opt.label }}</span>
							<Check v-if="opt.value === modelValue" :size="14" class="a-select__check" />
						</li>
					</ul>
				</motion.div>
			</AnimatePresence>
		</Teleport>
	</div>
</template>

<style scoped>
/* Root is sized by the consumer (w-full / flex-1 / explicit widths). */
.a-select {
	display: inline-flex;
	position: relative;
}

/* Trigger — the same glass control recipe formStyles builds for AppInput. */
/* Uniform dropdown typography: 13px like every sibling input in the app. */
.a-select__trigger {
	display: inline-flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.5rem;
	width: 100%;
	min-width: 0;
	text-align: left;
	font-size: 13px;
	border-radius: 0.375rem;
	border: 1px solid var(--border-default);
	/* Same surface as every sibling input — the cloudy glass lives in the
	   floating panel below, not on the resting control. */
	background: var(--surface-input);
	color: var(--text-primary);
	box-shadow: var(--specular-rim-subtle), var(--shadow-xs);
	cursor: pointer;
	transition:
		background var(--duration-control) var(--ease-out),
		border-color var(--duration-control) var(--ease-out),
		box-shadow var(--duration-control) var(--ease-out),
		transform var(--duration-control) var(--ease-out);
}
.a-select__trigger:hover:not(:disabled) {
	border-color: var(--border-strong);
	box-shadow: var(--specular-rim-subtle), var(--shadow-sm);
}
.a-select__trigger:focus-visible:not(:disabled) {
	border-color: var(--border-focus);
	background: var(--surface-primary);
	box-shadow: var(--focus-ring-glow), var(--specular-rim-subtle);
	outline: none;
}
/* Raised slightly while open — the control "lifts" toward its floating panel. */
.a-select__trigger[aria-expanded='true'] {
	transform: translateY(-1px);
	border-color: var(--border-focus);
	box-shadow: var(--specular-rim-subtle), var(--shadow-md);
}
.a-select__trigger:disabled {
	opacity: 0.55;
	cursor: not-allowed;
	box-shadow: none;
}
.a-select__trigger--error {
	border-color: var(--danger);
	box-shadow: 0 0 0 3px var(--danger-muted), var(--specular-rim-subtle);
}

.a-select--sm.a-select__trigger {
	padding: 0.375rem 0.625rem;
}
.a-select--md.a-select__trigger {
	padding: 0.5rem 0.75rem;
}

.a-select__value {
	flex: 1 1 auto;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.a-select__chevron {
	flex: 0 0 auto;
	color: var(--text-tertiary);
	transition: transform var(--duration-control) var(--ease-out);
}
.a-select__chevron--open {
	transform: rotate(180deg);
}

/* Floating panel: teleported to body, fixed to the measured trigger rect. */
.a-select__panel {
	padding: 0.375rem;
	border-radius: var(--radius-lg);
	/* Above ModalShell (z-[60]) since selects open inside that modal. */
	z-index: 70;
	max-height: 288px;
	overflow: hidden;
}

.a-select__list {
	list-style: none;
	margin: 0;
	padding: 0;
	max-height: 100%;
	overflow-y: auto;
	display: flex;
	flex-direction: column;
	gap: 0.125rem;
}

.a-select__option {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.5rem;
	padding: 0.375rem 0.5rem;
	border-radius: 0.375rem;
	font-size: 13px;
	color: var(--text-secondary);
	cursor: pointer;
	transition: background var(--duration-control) var(--ease-out), color var(--duration-control) var(--ease-out);
}
.a-select__option--active {
	background: var(--surface-tertiary);
	color: var(--text-primary);
}
.a-select__option--selected {
	color: var(--text-primary);
}

.a-select__option-label {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.a-select__check {
	flex: 0 0 auto;
	color: var(--accent-primary);
}
</style>
