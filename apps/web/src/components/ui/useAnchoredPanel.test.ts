import { describe, expect, it } from 'vitest';
import { getAnchoredPanelStyle } from './useAnchoredPanel';

const viewport = { width: 320, height: 240 };

describe('getAnchoredPanelStyle', () => {
	it('places a panel below its trigger when there is enough room', () => {
		expect(
			getAnchoredPanelStyle(
				{ left: 24, right: 84, top: 30, bottom: 54, width: 60 },
				100,
				viewport,
			),
		).toEqual({ position: 'fixed', top: '60px', left: '24px', width: '60px' });
	});

	it('flips above the trigger and clamps the panel to the viewport edges', () => {
		expect(
			getAnchoredPanelStyle(
				{ left: 290, right: 350, top: 100, bottom: 130, width: 60 },
				100,
				viewport,
			),
		).toEqual({ position: 'fixed', top: '6px', left: '254px', width: '60px' });
	});

	it('keeps the panel inside the top margin when it exceeds available space', () => {
		expect(
			getAnchoredPanelStyle(
				{ left: 0, right: 80, top: 12, bottom: 36, width: 80 },
				500,
				viewport,
			).top,
		).toBe('6px');
	});
});
