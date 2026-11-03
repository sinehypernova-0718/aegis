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
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { AnimatePresence, motion } from 'motion-v';
import { useVaultStore } from '@/stores/vaultStore';
import { useTheme } from '@/composables/useTheme';
import { usePageMotion } from '@/motion/composables/usePageMotion';
import { MotionPage } from '@/motion/components';
import { isDesignSystemRoute } from '@/types';

// Features
import UnlockView from '@/features/vault/UnlockView.vue';
import OverviewView from '@/features/overview/OverviewView.vue';
import PasswordsView from '@/features/passwords/PasswordsView.vue';
import ApiKeysView from '@/features/apikeys/ApiKeysView.vue';
import SshKeysView from '@/features/sshkeys/SshKeysView.vue';
import OAuth2View from '@/features/oauth2/OAuth2View.vue';
import SecureNotesView from '@/features/securenotes/SecureNotesView.vue';
import SecurityView from '@/features/security/SecurityView.vue';
import SettingsView from '@/features/settings/SettingsView.vue';

// Layout
import AppSidebar from '@/components/layout/AppSidebar.vue';
import AppToasts from '@/components/ui/AppToasts.vue';
import CreateCredentialModal from '@/components/vault/CreateCredentialModal.vue';

// Design-system showcase (Phase 1 review surface — hash route only, never
// renders vault data and is not part of the application navigation model).
import DesignSystemPreview from '@/design-system/DesignSystemPreview.vue';

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
