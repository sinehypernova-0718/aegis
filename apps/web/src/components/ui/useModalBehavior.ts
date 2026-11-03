import { nextTick, onUnmounted, watch } from 'vue';
import type { Ref } from 'vue';

const FOCUSABLE =
	'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Shared keyboard, focus, and scroll behavior for modal dialog presentations. */
export function useModalBehavior(
	open: Readonly<Ref<boolean>>,
	getPanel: () => HTMLElement | null,
	onClose: () => void,
): void {
	let previouslyFocused: HTMLElement | null = null;
	let wasOpen = false;

	function onKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.stopPropagation();
			onClose();
			return;
		}
		if (event.key !== 'Tab') return;

		const panel = getPanel();
		if (!panel) return;
		const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
		if (nodes.length === 0) return;
		const first = nodes[0]!;
		const last = nodes[nodes.length - 1]!;
		const active = document.activeElement;
		if (event.shiftKey && active === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && active === last) {
			event.preventDefault();
			first.focus();
		} else if (!panel.contains(active)) {
			event.preventDefault();
			first.focus();
		}
	}

	watch(
		open,
		async (isOpen) => {
			if (isOpen) {
				wasOpen = true;
				previouslyFocused =
					document.activeElement instanceof HTMLElement ? document.activeElement : null;
				document.documentElement.classList.add('modal-open');
				window.addEventListener('keydown', onKeydown, true);
				await nextTick();
				getPanel()?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
				return;
			}

			if (!wasOpen) return;
			wasOpen = false;
			document.documentElement.classList.remove('modal-open');
			window.removeEventListener('keydown', onKeydown, true);
			if (previouslyFocused?.isConnected) previouslyFocused.focus();
			previouslyFocused = null;
		},
		{ immediate: true },
	);

	onUnmounted(() => {
		window.removeEventListener('keydown', onKeydown, true);
		if (wasOpen) document.documentElement.classList.remove('modal-open');
	});
}
