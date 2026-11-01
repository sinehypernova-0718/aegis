<script setup lang="ts">
/**
 * SplitLayout — list/detail panel layout used by credential views.
 *
 * Responsive behaviour:
 *  - lg+ (≥1024 px): side-by-side panels. Sidebar width is configurable via
 *    the `sidebarWidth` prop (default 360 px); detail panel takes the
 *    remaining flex space.
 *  - Below lg: stacked. When nothing is selected the sidebar fills the full
 *    width. Selecting a credential hides the sidebar and shows the detail
 *    panel full-width. A visible "Back" bar at the top of the detail panel
 *    on small screens lets users return to the list without hunting for the
 *    close button inside the detail header.
 *
 * The close button in CredentialList (store.selectCredential(null)) also
 * returns to the list on mobile automatically via hasSelection going false.
 */
import { computed } from 'vue';
import { ArrowLeft } from 'lucide-vue-next';
import { useVaultStore } from '@/stores/vaultStore';

const props = withDefaults(defineProps<{ sidebarWidth?: string }>(), {
	sidebarWidth: '360px',
});

const store = useVaultStore();
const hasSelection = computed(() => store.selectedCredential !== null);

/**
 * Desktop sidebar width is driven by the public `sidebarWidth` prop through a
 * CSS custom property: `lg:w-[var(--sidebar-width)]` is a static class
 * (generatable by Tailwind) while the actual width stays caller-configurable.
 * Mobile behaviour (full-width / hidden stacking) is unchanged.
 */
const sidebarStyle = computed(() => ({
	'--sidebar-width': props.sidebarWidth,
	borderColor: 'var(--border-subtle)',
	background: 'var(--surface-primary)',
}));
</script>

<template>
  <div class="h-full flex overflow-hidden">
    <!-- Sidebar panel — desktop width comes from the sidebarWidth prop via
       --sidebar-width; below lg the responsive stacking classes apply. -->
    <div
      class="flex flex-col overflow-hidden border-r shrink-0 lg:w-[var(--sidebar-width)]"
      :class="hasSelection ? 'hidden lg:flex' : 'flex w-full'"
      :style="sidebarStyle"
    >
      <slot name="sidebar" />
    </div>

    <!-- Detail panel -->
    <div
      class="flex-1 min-w-0 overflow-hidden flex flex-col"
      :class="hasSelection ? 'flex' : 'hidden lg:flex'"
      :style="{ background: 'var(--surface-base)' }"
    >
      <!-- Mobile back-to-list bar (only visible below lg) -->
      <div
        v-if="hasSelection"
        class="lg:hidden shrink-0 flex items-center px-3 py-2 border-b"
        :style="{
          background: 'var(--surface-primary)',
          borderColor: 'var(--border-subtle)',
        }"
      >
        <button
          type="button"
          class="flex items-center gap-1.5 text-[12px] font-medium transition-colors"
          :style="{ color: 'var(--text-secondary)' }"
          @click="store.selectCredential(null)"
          aria-label="Back to credential list"
        >
          <ArrowLeft :size="14" aria-hidden="true" />
          Back to list
        </button>
      </div>

      <div class="flex-1 overflow-y-auto">
        <slot name="detail" />
      </div>
    </div>
  </div>
</template>
