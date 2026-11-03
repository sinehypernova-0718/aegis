import { onMounted, onUnmounted, ref } from 'vue';
import type { Ref } from 'vue';

const PANEL_GAP = 6;

export interface PanelRect {
	readonly left: number;
	readonly right: number;
	readonly top: number;
	readonly bottom: number;
	readonly width: number;
}

export function getAnchoredPanelStyle(
	trigger: PanelRect,
	panelHeight: number,
	viewport: { readonly width: number; readonly height: number },
): Record<string, string> {
	const spaceBelow = viewport.height - trigger.bottom;
	const top =
		spaceBelow >= panelHeight + PANEL_GAP
			? trigger.bottom + PANEL_GAP
			: Math.max(PANEL_GAP, trigger.top - panelHeight - PANEL_GAP);
	const left = Math.max(
		PANEL_GAP,
		Math.min(trigger.left, viewport.width - trigger.width - PANEL_GAP),
	);
	return {
		position: 'fixed',
		top: `${top}px`,
		left: `${left}px`,
		width: `${trigger.width}px`,
	};
}

interface AnchoredPanelOptions {
	readonly open: Readonly<Ref<boolean>>;
	readonly getTrigger: () => HTMLElement | null;
	readonly getPanel: () => HTMLElement | null;
	readonly getFallbackHeight: () => number;
}

/** Shared viewport positioning and reflow lifecycle for teleported select panels. */
export function useAnchoredPanel(options: AnchoredPanelOptions): {
	readonly panelStyle: Ref<Record<string, string>>;
	readonly positionPanel: () => void;
} {
	const panelStyle = ref<Record<string, string>>({});

	function positionPanel(): void {
		const trigger = options.getTrigger();
		if (!trigger) return;
		const rect = trigger.getBoundingClientRect();
		const panelHeight = options.getPanel()?.offsetHeight ?? options.getFallbackHeight();
		panelStyle.value = getAnchoredPanelStyle(rect, panelHeight, {
			width: window.innerWidth,
			height: window.innerHeight,
		});
	}

	function onReflow(): void {
		if (options.open.value) positionPanel();
	}

	onMounted(() => {
		document.addEventListener('scroll', onReflow, true);
		window.addEventListener('resize', onReflow);
	});

	onUnmounted(() => {
		document.removeEventListener('scroll', onReflow, true);
		window.removeEventListener('resize', onReflow);
	});

	return { panelStyle, positionPanel };
}
