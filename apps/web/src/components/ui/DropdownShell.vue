<script setup lang="ts">
/**
 * DropdownShell — unopinionated dropdown/menu presentation primitive.
 *
 * Trigger accessibility contract (WAI-ARIA menu pattern):
 *   - By default the shell renders a real, focusable <button> as the trigger,
 *     carrying aria-haspopup="menu", aria-expanded and aria-controls.
 *   - Alternatively, pass your own control via the #trigger slot; it receives
 *     `{ open, toggle, menuId }` slot props so YOU can bind
 *     aria-haspopup / aria-expanded / aria-controls on the actual focusable
 *     element. The shell no longer puts these attributes on a dead wrapper.
 *
 * Also provides: click-outside dismissal, auto-close on menu-item activation,
 * Escape dismissal with focus return to the trigger, arrow-key roving focus
 * over `[role="menuitem"]` children, and optional controlled open state.
 */
import { computed, nextTick, onUnmounted, ref, useId, useTemplateRef, watch } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { motion, AnimatePresence } from 'motion-v';
import { durations, easings, springs } from '@/motion/tokens';

interface Props {
	/** Align the panel to the end edge of the trigger. */
	align?: 'start' | 'end';
	/** Panel width as CSS value. */
	width?: string;
	/** Controlled open state. Leave undefined for internal (uncontrolled) state. */
	modelValue?: boolean;
	/** Label for the built-in trigger button (ignored when #trigger is used). */
	triggerLabel?: string;
	/** Extra classes for the built-in trigger button. */
	triggerClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
	align: 'start',
	width: '12rem',
	triggerLabel: 'Open menu',
});

const emit = defineEmits<{
	'update:modelValue': [open: boolean];
	openChange: [open: boolean];
}>();

const internalOpen = ref(props.modelValue ?? false);
const open = computed(() => props.modelValue ?? internalOpen.value);

watch(
	() => props.modelValue,
	(v) => {
		if (v !== undefined) internalOpen.value = v;
	},
);

const rootRef = ref<HTMLElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);
const menuId = useId();

// Built-in trigger element (template ref) and the control registered by a
// custom #trigger consumer via `setTriggerRef`. Exactly one is active.
const builtinTriggerRef = useTemplateRef<ComponentPublicInstance | HTMLElement>('builtinTrigger');
const customTriggerRef = ref<HTMLElement | null>(null);

function currentTrigger(): HTMLElement | null {
	const raw = builtinTriggerRef.value as ComponentPublicInstance | HTMLElement | Element | null;
	const el = raw instanceof Element ? raw : (raw?.$el ?? null);
	return ((el instanceof HTMLElement ? el : null) ?? customTriggerRef.value) as HTMLElement | null;
}

/**
 * Menu-item selector. Each role gets its own `:not([disabled])` filter —
 * `a, b, c:not([disabled])` would only apply the filter to `c`.
 */
const MENU_ITEM_SELECTOR = [
	'[role="menuitem"]',
	'[role="menuitemradio"]',
	'[role="menuitemcheckbox"]',
]
	.map((s) => `${s}:not([disabled])`)
	.join(', ');

/**
 * Why the menu is closing. Only `'escape'` restores focus to the trigger:
 *   - Outside pointer dismissal must NOT steal focus from the element the
 *     user just clicked into.
 *   - Tab dismissal must NOT yank focus backwards, or keyboard navigation
 *     through the page breaks.
 *   - Item activation delegates focus naturally to whatever the item does.
 */
type DismissReason = 'escape' | 'outside-pointer' | 'tab' | 'item-activation' | 'toggle';

function setOpen(value: boolean, reason: DismissReason = 'toggle') {
	if (open.value === value) return;
	internalOpen.value = value; // keeps uncontrolled mode consistent
	emit('update:modelValue', value);
	emit('openChange', value);
	if (value) {
		void nextTick(() => {
			panelRef.value?.querySelector<HTMLElement>(MENU_ITEM_SELECTOR)?.focus();
		});
	} else if (reason === 'escape') {
		// Return focus to the trigger control so users are not dumped back to
		// the top of the document. Prefer the registered trigger.
		currentTrigger()?.focus();
	}
}

function toggle() {
	setOpen(!open.value, 'toggle');
}

/** Slot props exposed to #trigger so the real control can carry ARIA state. */
const triggerSlotProps = {
	open,
	toggle,
	menuId,
	/** Register the consumer's focusable control for Escape/focus-return. */
	setTriggerRef: (el: Element | ComponentPublicInstance | null) => {
		// Guard: plain <button> refs are Elements directly; component refs expose
		// $el. A reactive slot prop can be undefined before first render, so
		// tolerate null/undefined rather than throwing inside the ref hook.
		if (!el) {
			customTriggerRef.value = null;
			return;
		}
		// Plain element refs are Elements already; component refs expose their
		// root node via `$el`. An explicit instanceof check is the only reliable
		// discriminator — do NOT probe for DOM APIs on the ref.
		const node = el instanceof HTMLElement ? el : (el as ComponentPublicInstance).$el;
		customTriggerRef.value = node instanceof HTMLElement ? node : null;
	},
};

function onDocPointer(e: PointerEvent) {
	const target = e.target as Element | null;
	if (!rootRef.value || !target) return;
	if (!rootRef.value.contains(target)) {
		if (open.value) setOpen(false, 'outside-pointer');
		return;
	}
	// Click landed on a menu item inside an open panel: close after the item's
	// own click handler runs (pointerdown precedes click), unless the row opts
	// out via data-dropdown-keep-open (e.g. checkbox rows).
	if (
		open.value &&
		target.closest(MENU_ITEM_SELECTOR) &&
		!target.closest('[data-dropdown-keep-open]')
	) {
		setTimeout(() => setOpen(false, 'item-activation'), 0);
	}
}

document.addEventListener('pointerdown', onDocPointer);
onUnmounted(() => document.removeEventListener('pointerdown', onDocPointer));

function onRootKeydown(e: KeyboardEvent) {
	if (e.key === 'Escape' && open.value) {
		e.preventDefault();
		setOpen(false, 'escape');
	}
}

function onPanelKeydown(e: KeyboardEvent) {
	const items = Array.from(panelRef.value?.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR) ?? []);
	if (items.length === 0) return;
	const i = items.indexOf(document.activeElement as HTMLElement);
	if (e.key === 'ArrowDown') {
		e.preventDefault();
		items[(i + 1) % items.length]?.focus();
	} else if (e.key === 'ArrowUp') {
		e.preventDefault();
		items[(i - 1 + items.length) % items.length]?.focus();
	} else if (e.key === 'Home') {
		e.preventDefault();
		items[0]?.focus();
	} else if (e.key === 'End') {
		e.preventDefault();
		items[items.length - 1]?.focus();
	} else if (e.key === 'Tab') {
		// Let the browser move focus naturally; closing must not re-focus the
		// trigger and fight the tab sequence.
		setOpen(false, 'tab');
	}
}
</script>

<template>
  <div ref="rootRef" class="relative inline-block" @keydown="onRootKeydown">
    <!-- Built-in accessible trigger: a real focusable button carrying the
         full WAI-ARIA menu-button contract. -->
    <button
      v-if="!$slots.trigger"
      ref="builtinTrigger"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="open ? menuId : undefined"
      :class="triggerClass"
      @click="toggle"
    >
      {{ triggerLabel }}
    </button>

    <!-- Custom trigger: the shell hands `open`, `toggle` and `menuId` to the
         slot so the consumer's actual control binds the ARIA attributes. -->
    <slot v-else name="trigger" v-bind="triggerSlotProps" />

    <AnimatePresence>
      <motion.div
        v-if="open"
        ref="panelRef"
        role="menu"
        :id="menuId"
        :initial="{ opacity: 0, scale: 0.95, y: -4 }"
        :animate="{ opacity: 1, scale: 1, y: 0, transition: { ...springs.snappy, opacity: { duration: durations.micro, ease: easings.out } } }"
        :exit="{ opacity: 0, scale: 0.97, y: -2, transition: { duration: durations.micro, ease: easings.in } }"
        class="a-glass a-glass--float absolute top-full mt-1.5 z-50 p-1.5 origin-top"
        :class="align === 'end' ? 'right-0' : 'left-0'"
        :style="{ width, borderRadius: 'var(--radius-lg)' }"
        @keydown="onPanelKeydown"
      >
        <slot />
      </motion.div>
    </AnimatePresence>
  </div>
</template>
