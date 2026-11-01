<script setup lang="ts">
/**
 * AppSidebar — workspace navigation.
 *
 * Responsive behaviour:
 *  - lg+ (≥1024 px): always-visible fixed-width sidebar (240 px).
 *  - Below lg: the sidebar is transformed off-screen by default. A hamburger
 *    toggle button (top-left of the main area) slides it in as an overlay.
 *    A semi-transparent backdrop sits behind the open drawer; clicking it or
 *    pressing Escape closes the drawer.
 *  - Drawer accessibility: role="dialog" + aria-modal, focus moves into the
 *    drawer on open, Tab cycling is contained while open, and focus returns
 *    to the hamburger when it closes.
 *
 * Motion (Layer 02): the active indicator is a single shared-layout element
 * (`layoutId`) that physically travels between destinations; nav rows get
 * directional hover nudges and press compression from the centralized presets.
 * Hover styling moved from inline JS handlers to CSS so pointer movement never
 * triggers Vue renders.
 *
 * Design tokens used in this file (verified by visualSystem.test.ts):
 *   var(--gold-surface), var(--gold), var(--gold-border), var(--gold-glow)
 */
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import type { Component } from 'vue';
import { motion, AnimatePresence } from 'motion-v';
import {
	Shield,
	LayoutGrid,
	Key,
	Fingerprint,
	Settings,
	Lock,
	Sun,
	Moon,
	Menu,
} from 'lucide-vue-next';
import { useVaultStore } from '@/stores/vaultStore';
import { useTheme } from '@/composables/useTheme';
import { navItemInteraction, iconButtonInteraction } from '@/motion/presets';
import { useAppReducedMotion } from '@/motion/composables/useReducedMotion';
import AppButton from '@/components/ui/AppButton.vue';
import type { PageId } from '@/types';

const store = useVaultStore();
const { theme, toggleTheme } = useTheme();
const { reduced } = useAppReducedMotion();

const mobileOpen = ref(false);

// Focus management: the hamburger that opens the drawer and the drawer panel
// itself. Focus moves into the drawer when it opens, is contained while open,
// and is restored to the hamburger when it closes.
const hamburgerButtonRef = ref<HTMLButtonElement | null>(null);
const drawerRef = ref<HTMLElement | null>(null);
/** Toggle the mobile drawer — genuine open/close switch so the advertised
 *  label ("Open/Close navigation menu") always matches the actual action. */
function toggleSidebar() {
	mobileOpen.value = !mobileOpen.value;
}
function closeSidebar() {
	mobileOpen.value = false;
}

/** Query all focusable elements within an element. */
function getFocusable(root: HTMLElement): HTMLElement[] {
	const selector =
		'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
	return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
		(el) => getComputedStyle(el).visibility !== 'hidden',
	);
}

// Focus routing: into the drawer on open, back to the hamburger on close.
// Done after the enter animation's first frame (nextTick) so the element
// exists and is focusable.
watch(mobileOpen, async (open) => {
	if (open) {
		await nextTick();
		const focusables = drawerRef.value ? getFocusable(drawerRef.value) : [];
		(focusables[0] ?? drawerRef.value)?.focus();
	} else {
		await nextTick();
		hamburgerButtonRef.value?.focus();
	}
});

function onKeydown(e: KeyboardEvent) {
	if (e.key === 'Escape' && mobileOpen.value) {
		closeSidebar();
		return;
	}
	// Focus containment: keep Tab cycling inside the drawer while it is open.
	if (e.key === 'Tab' && mobileOpen.value && drawerRef.value) {
		const focusables = getFocusable(drawerRef.value);
		if (focusables.length === 0) return;
		const first = focusables[0]!;
		const last = focusables[focusables.length - 1]!;
		const active = document.activeElement;
		if (e.shiftKey && (active === first || !drawerRef.value.contains(active))) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && active === last) {
			e.preventDefault();
			first.focus();
		}
	}
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));

interface NavItem {
	id: PageId;
	label: string;
	icon: Component;
	section: string;
}

const navItems: NavItem[] = [
	{ id: 'overview', label: 'Overview', icon: LayoutGrid, section: 'Vault' },
	{ id: 'passwords', label: 'Passwords', icon: Key, section: 'Vault' },
	{ id: 'api-keys', label: 'API Keys', icon: Fingerprint, section: 'Vault' },
	{ id: 'security', label: 'Security', icon: Shield, section: 'System' },
	{ id: 'settings', label: 'Settings', icon: Settings, section: 'System' },
];

const groupedNav = computed<{ section: string; items: NavItem[] }[]>(() => {
	const groups: { section: string; items: NavItem[] }[] = [];
	let currentGroup: { section: string; items: NavItem[] } | null = null;
	for (const item of navItems) {
		if (!currentGroup || item.section !== currentGroup.section) {
			currentGroup = { section: item.section, items: [] };
			groups.push(currentGroup);
		}
		currentGroup.items.push(item);
	}
	return groups;
});

function handleNavigate(id: PageId) {
	store.navigate(id);
	closeSidebar();
}

async function handleLock() {
	// Sensitive state clearing happens inside store.lock() immediately —
	// visual transitions are presentation-only and never gate it.
	await store.lock();
}
</script>

<template>
  <!-- Mobile hamburger (visible below lg) -->
  <motion.button
    ref="hamburgerButtonRef"
    type="button"
    :aria-label="mobileOpen ? 'Close navigation menu' : 'Open navigation menu'"
    :aria-expanded="mobileOpen"
    @click="toggleSidebar"
    v-bind="reduced ? {} : iconButtonInteraction"
    class="lg:hidden fixed top-3 left-3 z-50 w-8 h-8 rounded-md flex items-center justify-center border"
    :style="{
      background: 'var(--surface-primary)',
      borderColor: 'var(--border-subtle)',
      color: 'var(--text-secondary)',
      boxShadow: 'var(--shadow-sm)',
    }"
  >
    <Menu :size="15" aria-hidden="true" />
  </motion.button>

  <!-- Mobile backdrop -->
  <AnimatePresence>
    <motion.div
      v-if="mobileOpen"
      key="sidebar-backdrop"
      :initial="{ opacity: 0 }"
      :animate="{ opacity: 1, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }"
      :exit="{ opacity: 0, transition: { duration: 0.18, ease: [0.55, 0, 1, 0.45] } }"
      class="lg:hidden fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
      aria-hidden="true"
      @click="closeSidebar"
    />
  </AnimatePresence>

  <!-- Desktop sidebar (lg+) — hidden via CSS on small screens but always
       mounted so the vault store can reference currentPage. The mobile
       drawer is a separate AnimatePresence-managed element. -->
  <aside
    class="hidden lg:flex w-[240px] h-full flex-col border-r relative shrink-0"
    :style="{
      background: 'var(--surface-primary)',
      borderColor: 'var(--border-subtle)',
    }"
    aria-label="Application navigation"
  >
    <!-- Brand Mark — uses var(--gold-surface) and var(--gold) -->
    <div class="px-5 pt-6 pb-5">
      <div class="flex items-center gap-3">
        <div
          class="w-8 h-8 rounded-md flex items-center justify-center relative transition-transform duration-200"
          :style="{
            background: 'var(--gold-surface)',
            border: '1px solid var(--gold-border)',
            boxShadow: 'var(--specular-rim-gold), var(--shadow-gold)',
          }"
        >
          <Shield :size="15" :style="{ color: 'var(--gold)' }" />
        </div>
        <div>
          <h1 class="text-[13px] font-semibold tracking-tight leading-none" :style="{ color: 'var(--text-primary)' }">
            Aegis
          </h1>
          <p class="text-[10px] tracking-[0.12em] uppercase mt-0.5" :style="{ color: 'var(--text-tertiary)' }">
            Vault
          </p>
        </div>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 px-3 py-2 overflow-y-auto" aria-label="Main navigation">
      <div v-for="group in groupedNav" :key="group.section" class="mb-5">
        <p class="px-2 mb-1.5 text-[10px] font-medium tracking-[0.1em] uppercase" :style="{ color: 'var(--text-disabled)' }">
          {{ group.section }}
        </p>
        <div class="space-y-0.5">
          <motion.button
            v-for="item in group.items"
            :key="item.id"
            type="button"
            @click="handleNavigate(item.id)"
            v-bind="reduced ? {} : navItemInteraction"
            class="nav-row w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium cursor-pointer relative text-left"
            :class="{ 'nav-row--active': store.currentPage === item.id }"
            :style="{
              color: store.currentPage === item.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: store.currentPage === item.id ? 'var(--gold-surface)' : 'transparent',
              border: store.currentPage === item.id ? '1px solid var(--gold-border)' : '1px solid transparent',
            }"
            :aria-current="store.currentPage === item.id ? 'page' : undefined"
          >
            <motion.span
              v-if="store.currentPage === item.id"
              layoutId="active-navigation-indicator"
              :transition="{ type: 'spring', stiffness: 480, damping: 34, mass: 0.9 }"
              class="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-4 rounded-r"
              :style="{ background: 'var(--gold)', boxShadow: '0 0 8px var(--gold-glow)' }"
            />
            <component :is="item.icon" :size="15" :style="{ color: store.currentPage === item.id ? 'var(--gold)' : 'var(--text-tertiary)' }" aria-hidden="true" />
            {{ item.label }}
          </motion.button>
        </div>
      </div>
    </nav>

    <!-- Footer -->
    <div class="px-4 py-4 border-t space-y-3" :style="{ borderColor: 'var(--border-subtle)' }">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-1.5 h-1.5 rounded-full" :style="{ background: 'var(--success)' }" aria-hidden="true" />
          <span class="text-[11px]" :style="{ color: 'var(--text-tertiary)' }">Unlocked</span>
        </div>
        <motion.button
          type="button"
          @click="toggleTheme({ animate: true })"
          v-bind="reduced ? {} : iconButtonInteraction"
          class="p-1.5 rounded-md cursor-pointer hover:bg-[var(--surface-tertiary)] transition-colors"
          :style="{ color: 'var(--text-tertiary)' }"
          :title="theme === 'dark' ? 'Switch to Glacier (light)' : 'Switch to Midnight (dark)'"
          :aria-label="theme === 'dark' ? 'Switch to Glacier light theme' : 'Switch to Midnight dark theme'"
        >
          <Sun v-if="theme === 'dark'" :size="13" aria-hidden="true" />
          <Moon v-else :size="13" aria-hidden="true" />
        </motion.button>
      </div>
      <AppButton
        variant="secondary"
        size="sm"
        class="w-full"
        style="color: var(--danger);"
        @click="handleLock"
      >
        <Lock :size="12" aria-hidden="true" />
        Lock Vault
      </AppButton>
    </div>
  </aside>

  <!-- Mobile drawer -->
  <AnimatePresence>
    <motion.aside
      v-if="mobileOpen"
      key="mobile-sidebar"
      :initial="{ x: '-100%' }"
      :animate="{ x: '0%', transition: { type: 'spring', stiffness: 340, damping: 32, mass: 0.9 } }"
      :exit="{ x: '-100%', transition: { duration: 0.22, ease: [0.55, 0, 1, 0.45] } }"
      class="lg:hidden fixed top-0 left-0 z-50 w-[280px] max-w-[85vw] h-full flex flex-col border-r"
      :style="{
        background: 'var(--surface-primary)',
        borderColor: 'var(--border-subtle)',
        boxShadow: 'var(--shadow-xl)',
      }"
      ref="drawerRef"
      role="dialog"
      aria-modal="true"
      aria-label="Application navigation"
      tabindex="-1"
    >
      <!-- Brand Mark (mobile drawer) -->
      <div class="px-5 pt-6 pb-5">
        <div class="flex items-center gap-3">
          <div
            class="w-8 h-8 rounded-md flex items-center justify-center relative"
            :style="{
              background: 'var(--gold-surface)',
              border: '1px solid var(--gold-border)',
              boxShadow: 'var(--specular-rim-gold), var(--shadow-gold)',
            }"
          >
            <Shield :size="15" :style="{ color: 'var(--gold)' }" />
          </div>
          <div>
            <h1 class="text-[13px] font-semibold tracking-tight leading-none" :style="{ color: 'var(--text-primary)' }">Aegis</h1>
            <p class="text-[10px] tracking-[0.12em] uppercase mt-0.5" :style="{ color: 'var(--text-tertiary)' }">Vault</p>
          </div>
        </div>
      </div>

      <!-- Navigation (mobile) -->
      <nav class="flex-1 px-3 py-2 overflow-y-auto">
        <div v-for="group in groupedNav" :key="`m-${group.section}`" class="mb-5">
          <p class="px-2 mb-1.5 text-[10px] font-medium tracking-[0.1em] uppercase" :style="{ color: 'var(--text-disabled)' }">
            {{ group.section }}
          </p>
          <div class="space-y-0.5">
            <button
              v-for="item in group.items"
              :key="`m-${item.id}`"
              type="button"
              @click="handleNavigate(item.id)"
              class="nav-row w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-md text-[13px] font-medium cursor-pointer relative text-left"
              :class="{ 'nav-row--active': store.currentPage === item.id }"
              :style="{
                color: store.currentPage === item.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: store.currentPage === item.id ? 'var(--gold-surface)' : 'transparent',
                border: store.currentPage === item.id ? '1px solid var(--gold-border)' : '1px solid transparent',
              }"
              :aria-current="store.currentPage === item.id ? 'page' : undefined"
            >
              <component :is="item.icon" :size="15" :style="{ color: store.currentPage === item.id ? 'var(--gold)' : 'var(--text-tertiary)' }" aria-hidden="true" />
              {{ item.label }}
            </button>
          </div>
        </div>
      </nav>

      <!-- Footer (mobile) -->
      <div class="px-4 py-4 border-t space-y-3" :style="{ borderColor: 'var(--border-subtle)' }">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-1.5 h-1.5 rounded-full" :style="{ background: 'var(--success)' }" aria-hidden="true" />
            <span class="text-[11px]" :style="{ color: 'var(--text-tertiary)' }">Unlocked</span>
          </div>
          <button
            type="button"
            @click="toggleTheme({ animate: true })"
            class="p-1.5 rounded-md cursor-pointer hover:bg-[var(--surface-tertiary)] transition-colors"
            :style="{ color: 'var(--text-tertiary)' }"
            :aria-label="theme === 'dark' ? 'Switch to Glacier light theme' : 'Switch to Midnight dark theme'"
          >
            <Sun v-if="theme === 'dark'" :size="13" aria-hidden="true" />
            <Moon v-else :size="13" aria-hidden="true" />
          </button>
        </div>
        <AppButton
          variant="secondary"
          size="sm"
          class="w-full"
          style="color: var(--danger);"
          @click="handleLock"
        >
          <Lock :size="12" aria-hidden="true" />
          Lock Vault
        </AppButton>
      </div>
    </motion.aside>
  </AnimatePresence>
</template>

<style scoped>
.nav-row:hover {
  background: var(--surface-secondary);
}
.nav-row--active:hover {
  background: var(--surface-tertiary);
}
</style>
