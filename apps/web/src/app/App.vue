<script setup lang="ts">
/**
 * App.vue — application shell.
 *
 * Motion integration:
 *  - Locked ↔ unlocked environments transition cinematically via
 *    AnimatePresence (mode="wait" → no overlapping pages under rapid nav).
 *  - Page-to-page transitions are directional, driven by usePageMotion()
 *    (explicit nav-stack policy, not sidebar ordering) and rendered through
 *    the centralized MotionPage component.
 *  - Locking clears sensitive store state immediately; the visual exit is a
 *    pure presentation layer and never gates the security operation.
 */
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { AnimatePresence, motion } from 'motion-v';
import { useVaultStore } from '@/stores/vaultStore';
import { useTheme } from '@/composables/useTheme';
import { usePageMotion } from '@/motion/composables/usePageMotion';
import { MotionPage } from '@/motion/components';
import { isDesignSystemRoute } from '@/types';

// Features
import UnlockView from '@/features/vault/UnlockView.vue';

// Layout
import AppSidebar from '@/components/layout/AppSidebar.vue';
import AppToasts from '@/components/ui/AppToasts.vue';
import CreateCredentialModal from '@/components/vault/CreateCredentialModal.vue';

const OverviewView = defineAsyncComponent(() => import('@/features/overview/OverviewView.vue'));
const PasswordsView = defineAsyncComponent(() => import('@/features/passwords/PasswordsView.vue'));
const ApiKeysView = defineAsyncComponent(() => import('@/features/apikeys/ApiKeysView.vue'));
const SshKeysView = defineAsyncComponent(() => import('@/features/sshkeys/SshKeysView.vue'));
const OAuth2View = defineAsyncComponent(() => import('@/features/oauth2/OAuth2View.vue'));
const SecureNotesView = defineAsyncComponent(
	() => import('@/features/securenotes/SecureNotesView.vue'),
);
const SecurityView = defineAsyncComponent(() => import('@/features/security/SecurityView.vue'));
const SettingsView = defineAsyncComponent(() => import('@/features/settings/SettingsView.vue'));
// Load the isolated design-system preview only when its hash route is opened.
const DesignSystemPreview = defineAsyncComponent(
	() => import('@/design-system/DesignSystemPreview.vue'),
);

const store = useVaultStore();
const { initTheme } = useTheme();
const { pageKey, transition } = usePageMotion();

/** Reactive `#/design-system` hash route. */
const showDesignSystem = ref(isDesignSystemRoute(window.location.hash));
function onHashChange() {
	showDesignSystem.value = isDesignSystemRoute(window.location.hash);
}

onMounted(async () => {
	initTheme();
	window.addEventListener('hashchange', onHashChange);
	// The showcase is an isolated review surface: skip vault initialization
	// entirely while it is mounted so no client/state work happens behind it.
	if (!showDesignSystem.value) await store.init();
});

onBeforeUnmount(() => window.removeEventListener('hashchange', onHashChange));

watch(showDesignSystem, async (ds) => {
	// Leaving the showcase: initialize vault state if it never was.
	if (!ds && store.status.state === 'locked') await store.init();
});

watch(
	() => store.isUnlocked,
	(unlocked) => {
		if (unlocked) {
			store.loadAll();
			store.loadActivity();
		}
	},
	{ immediate: true },
);
</script>

<template>
  <div class="h-full w-full overflow-hidden" :style="{ background: 'var(--surface-base)' }">
    <!-- Design-system preview: full-screen review surface for Phase 1 -->
    <DesignSystemPreview v-if="showDesignSystem" />

    <AnimatePresence v-else mode="wait">
      <UnlockView v-if="!store.isUnlocked" key="unlock" />

      <motion.div
        v-else
        key="workspace"
        :initial="{ opacity: 0, scale: 0.985 }"
        :animate="{ opacity: 1, scale: 1, transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] } }"
        :exit="{ opacity: 0, scale: 0.98, transition: { duration: 0.24, ease: [0.55, 0, 1, 0.45] } }"
        class="h-full flex"
      >
        <AppSidebar />

        <!-- pt-12 on mobile reserves space for the hamburger toggle button;
             cleared at lg+ where the sidebar is always visible. -->
        <main class="flex-1 flex flex-col overflow-hidden relative pt-12 lg:pt-0">
          <!-- Directional page transitions. mode="wait" guarantees the exiting
               page is fully removed before the next mounts: no stale content,
               no overlap even under rapid repeated navigation. Keyed by page
               id so re-selecting the same page never remounts it. -->
          <AnimatePresence mode="wait">
            <MotionPage :key="pageKey" :spec="transition" class="flex-1 min-h-0 overflow-hidden">
              <OverviewView v-if="pageKey === 'overview'" class="h-full" />
              <PasswordsView v-else-if="pageKey === 'passwords'" class="h-full" />
              <ApiKeysView v-else-if="pageKey === 'api-keys'" class="h-full" />
              <SshKeysView v-else-if="pageKey === 'ssh-keys'" class="h-full" />
              <OAuth2View v-else-if="pageKey === 'oauth2'" class="h-full" />
              <SecureNotesView v-else-if="pageKey === 'secure-notes'" class="h-full" />
              <SecurityView v-else-if="pageKey === 'security'" class="h-full" />
              <SettingsView v-else-if="pageKey === 'settings'" class="h-full" />
            </MotionPage>
          </AnimatePresence>
        </main>

        <AppToasts />
        <CreateCredentialModal />
      </motion.div>
    </AnimatePresence>
  </div>
</template>
