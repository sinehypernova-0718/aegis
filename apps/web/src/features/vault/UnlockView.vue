<script setup lang="ts">
/**
 * UnlockView.vue — Vault lifecycle and authentication orchestrator.
 *
 * Responsibilities:
 * 1. Explicit initialization loading gate (prevents setup before status is resolved)
 * 2. Service connection error handling with retry
 * 3. First-run vault setup (passphrase creation & validation)
 * 4. Recovery-key presentation & confirmation (only when supplied by backend)
 * 5. Master passphrase vault unlocking
 * 6. Recovery key entry and recovery states
 * 7. Lock failure handling & reconciliation
 * 8. Status reconciliation handling when auth succeeds but sync fails
 * 9. Development testing mock switcher (strictly gated by import.meta.env.DEV)
 */
import { ref, computed } from 'vue';
import { motion, AnimatePresence } from 'motion-v';
import { Shield, Sparkles, RefreshCw, AlertTriangle } from 'lucide-vue-next';
import { useVaultStore } from '@/stores/vaultStore';
import { useAppReducedMotion } from '@/motion/composables/useReducedMotion';
import { emblemPulse } from '@/motion/presets';
import GlassPanel from '@/components/ui/GlassPanel.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppSpinner from '@/components/ui/AppSpinner.vue';

// Cards
import VaultSetupCard from './VaultSetupCard.vue';
import VaultRecoverySetupCard from './VaultRecoverySetupCard.vue';
import VaultUnlockCard from './VaultUnlockCard.vue';
import VaultRecoveryCard from './VaultRecoveryCard.vue';

const isDev = Boolean(import.meta.env?.DEV);

const store = useVaultStore();
const { reduced } = useAppReducedMotion();

const isRecoveryMode = ref(false);

const activeStep = computed(() => {
	if (store.isInitializing) return 'initializing';
	if (store.initError) return 'init-error';
	if (store.status.state === 'uninitialized') {
		return store.recoveryKeyPresented ? 'setup-recovery' : 'setup-passphrase';
	}
	return isRecoveryMode.value ? 'unlock-recovery' : 'unlock-passphrase';
});

function switchToRecovery() {
	store.error = null;
	isRecoveryMode.value = true;
}

function cancelRecovery() {
	store.error = null;
	isRecoveryMode.value = false;
}

// Development testing state switcher — strictly development-only
async function toggleMockState(state: 'uninitialized' | 'locked') {
	if (!isDev) return;
	const { setMockVaultState } = await import('@/services/mock/mockVaultClient');
	setMockVaultState(state);
	await store.init();
	isRecoveryMode.value = false;
}
</script>

<template>
  <div class="h-full w-full relative flex flex-col items-center justify-center p-6 overflow-hidden" :style="{ background: 'var(--surface-base)' }">
    <!-- Ambient Aurora Backdrop (Cinematic Glassmorphism) -->
    <div class="a-aurora" aria-hidden="true">
      <div class="a-aurora__blob a-aurora__blob--1" />
      <div class="a-aurora__blob a-aurora__blob--2" />
      <div class="a-aurora__blob a-aurora__blob--3" />
    </div>

    <!-- Centered Vault Experience Container -->
    <div class="relative z-10 w-full max-w-[440px] flex flex-col items-center">
      <!-- Security Emblem & Brand -->
      <motion.div
        :initial="{ opacity: 0, y: -16 }"
        :animate="{ opacity: 1, y: 0 }"
        :transition="{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }"
        class="text-center mb-6"
      >
        <motion.div
          class="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3.5 relative"
          :style="{
            background: 'var(--surface-primary)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-md), var(--shadow-accent)',
          }"
          v-bind="reduced ? {} : emblemPulse"
        >
          <!-- Inner golden aura ring -->
          <div
            class="absolute inset-0 rounded-2xl pointer-events-none opacity-40"
            :style="{ border: '1px solid var(--gold-border)' }"
          />
          <Shield :size="24" :style="{ color: 'var(--accent-primary)' }" />
        </motion.div>

        <h1 class="a-title tracking-tight" :style="{ color: 'var(--text-primary)' }">
          Aegis
        </h1>
        <p class="a-meta tracking-wider uppercase mt-1" :style="{ color: 'var(--text-tertiary)' }">
          Local-First Security Vault
        </p>
      </motion.div>

      <!-- Lock Failure Warning Banner -->
      <div
        v-if="store.lockError"
        role="alert"
        class="w-full mb-4 p-3.5 rounded-lg border flex items-start justify-between gap-3 text-[12px]"
        :style="{
          background: 'var(--danger-muted)',
          borderColor: 'var(--danger)',
          color: 'var(--danger)',
        }"
      >
        <div class="flex items-start gap-2.5">
          <AlertTriangle :size="16" class="shrink-0 mt-0.5" />
          <span>{{ store.lockError }}</span>
        </div>
        <button
          type="button"
          class="px-2.5 py-1 text-[11px] font-semibold rounded shrink-0 border transition-colors cursor-pointer"
          :style="{
            borderColor: 'var(--danger)',
            background: 'var(--surface-primary)',
            color: 'var(--danger)',
          }"
          :disabled="store.isLocking"
          @click="store.retryLock()"
        >
          <span v-if="store.isLocking">Retrying...</span>
          <span v-else>Retry Lock</span>
        </button>
      </div>

      <!-- Reconciliation Error Banner -->
      <div
        v-if="store.reconciliationError"
        role="alert"
        class="w-full mb-4 p-3.5 rounded-lg border flex items-start justify-between gap-3 text-[12px]"
        :style="{
          background: 'var(--warning-muted)',
          borderColor: 'var(--warning)',
          color: 'var(--text-primary)',
        }"
      >
        <div class="flex items-start gap-2.5">
          <AlertTriangle :size="16" class="shrink-0 mt-0.5" :style="{ color: 'var(--warning)' }" />
          <span>{{ store.reconciliationError }}</span>
        </div>
        <button
          type="button"
          class="px-2.5 py-1 text-[11px] font-semibold rounded shrink-0 border transition-colors cursor-pointer"
          :style="{
            borderColor: 'var(--warning)',
            background: 'var(--surface-primary)',
            color: 'var(--warning)',
          }"
          :disabled="store.isReconciling"
          @click="store.reconcileStatus()"
        >
          <span v-if="store.isReconciling">Syncing...</span>
          <span v-else>Retry Sync</span>
        </button>
      </div>

      <!-- Glass Shell Surface -->
      <GlassPanel
        depth="elevated"
        :gold="activeStep === 'setup-recovery'"
        radius="var(--radius-xl)"
        class="w-full p-6 sm:p-8"
        :style="{
          boxShadow: 'var(--shadow-xl)',
        }"
      >
        <!-- Animated Card Transitions -->
        <AnimatePresence mode="wait">
          <!-- State A: Initialization Loading Gate -->
          <motion.div
            v-if="activeStep === 'initializing'"
            key="initializing"
            :initial="{ opacity: 0 }"
            :animate="{ opacity: 1 }"
            :exit="{ opacity: 0 }"
            :transition="{ duration: 0.2 }"
            class="py-8 flex flex-col items-center text-center gap-3"
          >
            <AppSpinner :size="20" />
            <h2 class="a-subheading font-medium" :style="{ color: 'var(--text-primary)' }">
              Connecting to Vault Service
            </h2>
            <p class="a-supporting" :style="{ color: 'var(--text-tertiary)' }">
              Establishing connection and verifying backend status...
            </p>
          </motion.div>

          <!-- State B: Connection Error State with Retry -->
          <motion.div
            v-else-if="activeStep === 'init-error'"
            key="init-error"
            :initial="{ opacity: 0, scale: 0.96 }"
            :animate="{ opacity: 1, scale: 1 }"
            :exit="{ opacity: 0, scale: 0.96 }"
            :transition="{ duration: 0.25 }"
            class="py-4 flex flex-col items-center text-center gap-4"
          >
            <div
              class="w-12 h-12 rounded-full flex items-center justify-center"
              :style="{ background: 'var(--danger-muted)', color: 'var(--danger)' }"
            >
              <AlertTriangle :size="22" />
            </div>
            <div>
              <h2 class="a-subheading font-semibold" :style="{ color: 'var(--text-primary)' }">
                Backend Service Unavailable
              </h2>
              <p class="a-supporting mt-1.5" :style="{ color: 'var(--text-secondary)' }">
                {{ store.initError }}
              </p>
            </div>
            <AppButton
              variant="primary"
              size="md"
              @click="store.init()"
            >
              <RefreshCw :size="13" />
              <span>Retry Connection</span>
            </AppButton>
          </motion.div>

          <!-- Step 1: First-Run Passphrase Creation (only when confirmed uninitialized) -->
          <motion.div
            v-else-if="activeStep === 'setup-passphrase'"
            key="setup-passphrase"
            :initial="{ opacity: 0, scale: 0.96, y: 8 }"
            :animate="{ opacity: 1, scale: 1, y: 0 }"
            :exit="{ opacity: 0, scale: 0.96, y: -8 }"
            :transition="{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }"
          >
            <VaultSetupCard />
          </motion.div>

          <!-- Step 2: First-Run Recovery Key Confirmation -->
          <motion.div
            v-else-if="activeStep === 'setup-recovery'"
            key="setup-recovery"
            :initial="{ opacity: 0, scale: 0.96, y: 8 }"
            :animate="{ opacity: 1, scale: 1, y: 0 }"
            :exit="{ opacity: 0, scale: 0.96, y: -8 }"
            :transition="{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }"
          >
            <VaultRecoverySetupCard />
          </motion.div>

          <!-- Step 3: Locked Vault Passphrase Unlock (only when confirmed locked) -->
          <motion.div
            v-else-if="activeStep === 'unlock-passphrase'"
            key="unlock-passphrase"
            :initial="{ opacity: 0, scale: 0.96, y: 8 }"
            :animate="{ opacity: 1, scale: 1, y: 0 }"
            :exit="{ opacity: 0, scale: 0.96, y: -8 }"
            :transition="{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }"
          >
            <VaultUnlockCard @switch-to-recovery="switchToRecovery" />
          </motion.div>

          <!-- Step 4: Locked Vault Recovery Entry -->
          <motion.div
            v-else-if="activeStep === 'unlock-recovery'"
            key="unlock-recovery"
            :initial="{ opacity: 0, scale: 0.96, y: 8 }"
            :animate="{ opacity: 1, scale: 1, y: 0 }"
            :exit="{ opacity: 0, scale: 0.96, y: -8 }"
            :transition="{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }"
          >
            <VaultRecoveryCard @cancel-recovery="cancelRecovery" />
          </motion.div>
        </AnimatePresence>
      </GlassPanel>

      <!-- Development Mock Adapter Status & State Switcher (DEVELOPMENT ONLY) -->
      <motion.div
        v-if="isDev"
        :initial="{ opacity: 0 }"
        :animate="{ opacity: 1 }"
        :transition="{ delay: 0.3, duration: 0.4 }"
        class="mt-6 flex flex-col items-center gap-2"
      >
        <div class="flex items-center gap-2 text-[11px]" :style="{ color: 'var(--text-disabled)' }">
          <Sparkles :size="11" :style="{ color: 'var(--gold)' }" />
          <span>Development Mock Adapter</span>
          <span>•</span>
          <span class="font-mono uppercase">{{ store.isInitializing ? 'connecting' : (store.initError ? 'unavailable' : store.status.state) }}</span>
        </div>

        <!-- Testing Switcher: allows developers/reviewers in DEV mode to test both flows -->
        <div
          class="inline-flex items-center gap-1.5 p-1 rounded-md border text-[11px]"
          :style="{
            background: 'var(--surface-input)',
            borderColor: 'var(--border-subtle)',
          }"
        >
          <span class="px-1 text-[10px] uppercase font-semibold" :style="{ color: 'var(--text-tertiary)' }">
            Test flow:
          </span>
          <button
            type="button"
            class="px-2 py-0.5 rounded transition-colors cursor-pointer"
            :style="{
              background: store.status.state === 'uninitialized' && !store.isInitializing ? 'var(--accent-primary)' : 'transparent',
              color: store.status.state === 'uninitialized' && !store.isInitializing ? 'var(--text-on-accent)' : 'var(--text-secondary)',
              fontWeight: store.status.state === 'uninitialized' ? '600' : '400',
            }"
            @click="toggleMockState('uninitialized')"
          >
            1. First-Run Setup
          </button>
          <button
            type="button"
            class="px-2 py-0.5 rounded transition-colors cursor-pointer"
            :style="{
              background: store.status.state === 'locked' && !store.isInitializing ? 'var(--accent-primary)' : 'transparent',
              color: store.status.state === 'locked' && !store.isInitializing ? 'var(--text-on-accent)' : 'var(--text-secondary)',
              fontWeight: store.status.state === 'locked' ? '600' : '400',
            }"
            @click="toggleMockState('locked')"
          >
            2. Unlock & Recovery
          </button>
        </div>
      </motion.div>
    </div>
  </div>
</template>
