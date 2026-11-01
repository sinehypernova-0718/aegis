<script setup lang="ts">
/**
 * AppTabs — segmented tab bar with a spring-driven selection indicator.
 *
 * Unopinionated shell: emits the selected id; owns no routing/state.
 * The sliding pill uses `springs.snappy` (layout transitions done with
 * transforms only — GPU-friendly, no layout thrash).
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { motion } from 'motion-v';

export interface TabItem {
	id: string;
	label: string;
}

interface Props {
	tabs: TabItem[];
	modelValue?: string;
}

const props = withDefaults(defineProps<Props>(), {});

const emit = defineEmits<{ 'update:modelValue': [id: string] }>();

const listRef = ref<HTMLElement | null>(null);
const activeId = computed(() => props.modelValue ?? props.tabs[0]?.id ?? '');

/**
 * Indicator geometry lives in reactive state — NOT in a computed that reads
 * the DOM. A computed would be evaluated during setup (before mount, when
 * measurements are zero) and would never re-evaluate on resize because DOM
 * reads are not reactive dependencies. Instead we measure imperatively at
 * mount, after tab/size changes (nextTick), and on container resize via a
 * ResizeObserver, storing plain refs the template can render from.
 */
const indicatorLeft = ref(0);
const indicatorWidth = ref(0);

function rectOf(id: string): { left: number; width: number } {
	const list = listRef.value;
	const el = list?.querySelector<HTMLElement>(`[data-tab="${id}"]`);
	if (!el || !list) return { left: 0, width: 0 };
	const parentRect = list.getBoundingClientRect();
	const r = el.getBoundingClientRect();
	return { left: r.left - parentRect.left, width: r.width };
}

function measure() {
	const r = rectOf(activeId.value);
	indicatorLeft.value = r.left;
	indicatorWidth.value = r.width;
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
	measure();
	if (listRef.value && typeof ResizeObserver !== 'undefined') {
		resizeObserver = new ResizeObserver(measure);
		resizeObserver.observe(listRef.value);
	}
});

onBeforeUnmount(() => resizeObserver?.disconnect());

watch([activeId, () => props.tabs], () => void nextTick(measure));

function select(id: string) {
	emit('update:modelValue', id);
}

/**
 * Move DOM focus to a tab button (roving tabindex: only the selected tab is
 * tabbable, so arrow navigation must follow selection or focus gets stranded
 * on a tabindex="-1" tab). Selection is v-model-driven and may only reach the
 * DOM after the parent re-renders, hence the nextTick.
 */
function focusTab(id: string) {
	void nextTick(() => {
		listRef.value?.querySelector<HTMLElement>(`[data-tab="${id}"]`)?.focus();
	});
}

function onKeydown(e: KeyboardEvent) {
	const ids = props.tabs.map((t) => t.id);
	if (ids.length === 0) return;
	const i = ids.indexOf(activeId.value);
	let next: string | undefined;
	if (e.key === 'ArrowRight') next = ids[(i + 1) % ids.length];
	else if (e.key === 'ArrowLeft') next = ids[(i - 1 + ids.length) % ids.length];
	if (!next) return;
	e.preventDefault(); // keep arrow keys from scrolling the viewport
	select(next);
	focusTab(next);
}
</script>

<template>
  <div
    ref="listRef"
    role="tablist"
    class="relative inline-flex items-center p-1 rounded-lg border"
    :style="{ background: 'var(--glass-bg-subtle)', borderColor: 'var(--border-subtle)' }"
    @keydown="onKeydown"
  >
    <!-- Spring-tracked selection pill (hidden until first measurement so it
         never flashes at zero width before onMounted runs) -->
    <motion.div
      v-show="indicatorWidth > 0"
      class="absolute top-1 bottom-1 rounded-md"
      :style="{ width: `${indicatorWidth}px` }"
      :initial="false"
      :animate="{ x: indicatorLeft, transition: { type: 'spring', stiffness: 480, damping: 34, mass: 0.9 } }"
      aria-hidden="true"
    >
      <div class="w-full h-full rounded-md" :style="{ background: 'var(--gradient-accent)', boxShadow: 'var(--shadow-sm)' }" />
    </motion.div>

    <button
      v-for="tab in tabs"
      :key="tab.id"
      :data-tab="tab.id"
      role="tab"
      type="button"
      :aria-selected="activeId === tab.id"
      :tabindex="activeId === tab.id ? 0 : -1"
      class="relative z-10 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors outline-none"
      :style="{ color: activeId === tab.id ? 'var(--text-on-accent)' : 'var(--text-secondary)' }"
      @click="select(tab.id)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
