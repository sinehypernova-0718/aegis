<script setup lang="ts">
/**
 * ModalShell — unopinionated modal presentation primitive.
 *
 * Provides: teleport, scrim, focus trap (Tab cycling + initial focus),
 * Escape-to-close, scroll lock, cinematic enter/exit choreography, and the
 * `a-glass--modal` surface. Slots only — no business logic, no forms.
 */
import { nextTick, onUnmounted, ref, watch } from 'vue';
import { motion, AnimatePresence } from 'motion-v';
import { durations, easings, springs } from '@/motion/tokens';

interface Props {
	open: boolean;
	/** Accessible name for the dialog region. */
	labelledBy?: string;
	/** Max width of the panel. */
	maxWidth?: string;
}

const props = withDefaults(defineProps<Props>(), {
	maxWidth: '28rem',
});

const emit = defineEmits<{ close: [] }>();

const panelRef = ref<HTMLElement | null>(null);

const FOCUSABLE =
	'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function onKeydown(e: KeyboardEvent) {
	if (e.key === 'Escape') {
		e.stopPropagation();
		emit('close');
		return;
	}
	if (e.key !== 'Tab' || !panelRef.value) return;
	const nodes = Array.from(panelRef.value.querySelectorAll<HTMLElement>(FOCUSABLE));
	if (nodes.length === 0) return;
	const first = nodes[0]!;
	const last = nodes[nodes.length - 1]!;
	const active = document.activeElement;
	if (e.shiftKey && active === first) {
		e.preventDefault();
		last.focus();
	} else if (!e.shiftKey && active === last) {
		e.preventDefault();
		first.focus();
	} else if (!panelRef.value.contains(active)) {
		e.preventDefault();
		first.focus();
	}
}

let previouslyFocused: HTMLElement | null = null;

watch(
	() => props.open,
	async (open) => {
		if (open) {
			// Remember the invoking element so focus can be restored on close.
			previouslyFocused =
				document.activeElement instanceof HTMLElement ? document.activeElement : null;
			// Lock background scroll by preventing wheel/touch on document.
			// We do NOT use `body.overflow = hidden` here because the modal's own
			// scroll container (overflow-y: auto on the fixed wrapper) must remain
			// scrollable — locking the body would prevent that.
			document.documentElement.classList.add('modal-open');
			window.addEventListener('keydown', onKeydown, true);
			await nextTick();
			panelRef.value?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
		} else {
			document.documentElement.classList.remove('modal-open');
			window.removeEventListener('keydown', onKeydown, true);
			// Restore focus to the opener (if still in the document) when closing.
			if (previouslyFocused?.isConnected) previouslyFocused.focus();
			previouslyFocused = null;
		}
	},
	// immediate: handles `open=true` at mount time — without it the initial
	// state would render the dialog but never lock scroll or move focus in.
	{ immediate: true },
);

onUnmounted(() => {
	window.removeEventListener('keydown', onKeydown, true);
	if (props.open) document.documentElement.classList.remove('modal-open');
});

const scrimTransition = { duration: durations.control, ease: easings.inOut };
</script>

<template>
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="open"
        :initial="{ opacity: 0 }"
        :animate="{ opacity: 1, transition: scrimTransition }"
        :exit="{ opacity: 0, transition: { duration: durations.micro, ease: easings.in } }"
        class="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4"
      >
        <!-- Scrim: dim + light blur only; heavy blur is reserved for the panel -->
        <div
          class="fixed inset-0"
          :style="{ background: 'var(--surface-overlay)', backdropFilter: 'blur(var(--blur-xs))', WebkitBackdropFilter: 'blur(var(--blur-xs))' }"
          @click="emit('close')"
        />

        <motion.div
          ref="panelRef"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="labelledBy"
          :initial="{ opacity: 0, scale: 0.95, y: 14 }"
          :animate="{ opacity: 1, scale: 1, y: 0, transition: springs.dialog }"
          :exit="{ opacity: 0, scale: 0.965, y: 8, transition: { duration: durations.micro, ease: easings.in } }"
          class="a-glass a-glass--modal relative w-full my-auto p-6"
          :style="{ maxWidth, borderRadius: 'var(--radius-xl)' }"
        >
          <slot />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>
