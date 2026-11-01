/**
 * useScrollContainer — shared access to Aegis's actual nested scroll
 * container (the PageContainer inner scroller).
 *
 * Views import the same `pageScroller` ref and pass it to
 * ScrollProgressBar / ParallaxLayer, so every scroll-linked effect binds to
 * the element that actually scrolls — no window-scroll assumptions, no
 * manual listeners, no repeated DOM measurement (motion-v's useScroll owns
 * the observation and cleans up on unmount).
 */
import { ref, type Ref } from 'vue';

/** The current page-level scrolling element (set by PageContainer). */
export const pageScroller: Ref<HTMLElement | undefined> = ref(undefined);

/** Register the scroller element from the nearest PageContainer. */
export function useScrollContainer(): {
	scrollerRef: (el: HTMLElement | null) => void;
} {
	const scrollerRef = (el: HTMLElement | null): void => {
		pageScroller.value = el ?? undefined;
	};
	return { scrollerRef };
}
