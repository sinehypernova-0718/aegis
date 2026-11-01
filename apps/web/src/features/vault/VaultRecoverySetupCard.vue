<script setup lang="ts">
/**
 * VaultRecoverySetupCard.vue — Emergency Recovery Key presentation.
 *
 * Requirements:
 * - Presented only when supplied by backend
 * - Masked by default for privacy with intentional reveal toggle
 * - Copy to clipboard button with tactile confirmPop feedback
 * - Prominent warning callout requiring offline backup
 * - Explicit confirmation checkbox required before completing setup
 * - Zero persistence in browser storage (localStorage, sessionStorage, URL)
 * - Memory hygiene: cleared from reactive component state upon completion or exit
 */
import { ref, computed, onBeforeUnmount } from 'vue';
import { motion } from 'motion-v';
import {
	KeyRound,
	Eye,
	EyeOff,
	Copy,
	Check,
	AlertTriangle,
	ShieldAlert,
	ArrowRight,
} from 'lucide-vue-next';
import { useVaultStore } from '@/stores/vaultStore';
import { confirmPop } from '@/motion/presets';
import { useAppReducedMotion } from '@/motion/composables/useReducedMotion';
import AppButton from '@/components/ui/AppButton.vue';

const store = useVaultStore();
const { reduced } = useAppReducedMotion();

const isRevealed = ref(false);
const hasCopied = ref(false);
const isConfirmed = ref(false);
const isCompleting = ref(false);
const copyTimeout = ref<number | null>(null);

const rawKey = computed(() => store.recoveryKeyPresented || '');

// Formatted display (masked vs revealed)
const displayKey = computed(() => {
	if (!rawKey.value) return '';
	if (isRevealed.value) return rawKey.value;
	return '••••-••••-••••-••••-••••';
});

async function copyToClipboard() {
	if (!rawKey.value) return;
	try {
		await navigator.clipboard.writeText(rawKey.value);
		hasCopied.value = true;
		if (copyTimeout.value) window.clearTimeout(copyTimeout.value);
		copyTimeout.value = window.setTimeout(() => {
			hasCopied.value = false;
		}, 2500);
	} catch {
		// Fallback if clipboard API is restricted
		hasCopied.value = false;
	}
}

async function handleComplete() {
	if (!isConfirmed.value || isCompleting.value) return;
	isCompleting.value = true;
	try {
		await store.completeSetup();
	} finally {
		isCompleting.value = false;
	}
}

onBeforeUnmount(() => {
	if (copyTimeout.value) window.clearTimeout(copyTimeout.value);
	isRevealed.value = false;
	hasCopied.value = false;
	isConfirmed.value = false;
});
</script>

<template>
  <div class="w-full">
    <!-- Header -->
    <div class="mb-5">
      <div class="flex items-center gap-2 mb-1.5">
        <KeyRound :size="16" :style="{ color: 'var(--gold)' }" />
        <h2 class="a-subheading font-semibold" :style="{ color: 'var(--text-primary)' }">
          Emergency Recovery Key
        </h2>
      </div>
      <p class="a-supporting" :style="{ color: 'var(--text-tertiary)' }">
        The backend has generated an emergency recovery key for your vault. If you ever lose your master passphrase, this is the only way to recover your data.
      </p>
    </div>

    <!-- Prominent Warning Callout -->
    <div
      class="p-3.5 mb-5 rounded-md border flex items-start gap-3"
      :style="{
        background: 'var(--gold-muted)',
        borderColor: 'var(--gold-border)',
      }"
    >
      <ShieldAlert :size="17" class="shrink-0 mt-0.5" :style="{ color: 'var(--gold)' }" />
      <div class="text-[12px] space-y-1" :style="{ color: 'var(--text-secondary)' }">
        <p class="font-medium" :style="{ color: 'var(--gold-bright)' }">
          Store this key offline in a secure place.
        </p>
        <p class="text-[11px]" :style="{ color: 'var(--text-tertiary)' }">
          Never store it on an unencrypted drive or online service. Aegis cannot restore your vault if both passphrase and recovery key are lost.
        </p>
      </div>
    </div>

    <!-- Recovery Key Display Box -->
    <div
      class="p-4 rounded-lg border mb-5 flex flex-col gap-3"
      :style="{
        background: 'var(--surface-input)',
        borderColor: 'var(--border-default)',
      }"
    >
      <div class="flex items-center justify-between">
        <span class="a-label" :style="{ color: 'var(--text-tertiary)' }">Recovery Key</span>
        <div class="flex items-center gap-2">
          <!-- Reveal / Mask toggle button -->
          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer"
            :style="{
              color: isRevealed ? 'var(--accent-primary)' : 'var(--text-tertiary)',
              background: 'var(--surface-secondary)',
              border: '1px solid var(--border-subtle)',
            }"
            :aria-label="isRevealed ? 'Mask recovery key' : 'Reveal recovery key'"
            @click="isRevealed = !isRevealed"
          >
            <component :is="isRevealed ? EyeOff : Eye" :size="13" />
            <span>{{ isRevealed ? 'Mask' : 'Reveal' }}</span>
          </button>

          <!-- Copy button -->
          <motion.button
            type="button"
            class="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer"
            :style="{
              color: hasCopied ? 'var(--success)' : 'var(--text-secondary)',
              background: hasCopied ? 'var(--success-muted)' : 'var(--surface-secondary)',
              border: `1px solid ${hasCopied ? 'var(--success)' : 'var(--border-subtle)'}`,
            }"
            :aria-label="hasCopied ? 'Copied to clipboard' : 'Copy recovery key'"
            v-bind="reduced ? {} : (hasCopied ? confirmPop : {})"
            @click="copyToClipboard"
          >
            <Check v-if="hasCopied" :size="13" />
            <Copy v-else :size="13" />
            <span>{{ hasCopied ? 'Copied!' : 'Copy' }}</span>
          </motion.button>
        </div>
      </div>

      <!-- Key string presentation -->
      <div
        class="py-2.5 px-3 rounded border select-all tracking-wider font-mono text-[13px] text-center"
        :style="{
          background: 'var(--surface-base)',
          borderColor: 'var(--border-subtle)',
          color: isRevealed ? 'var(--text-primary)' : 'var(--text-disabled)',
        }"
      >
        {{ displayKey }}
      </div>
    </div>

    <!-- Explicit Confirmation Checkbox -->
    <div class="mb-6">
      <label
        class="flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors"
        :style="{
          background: isConfirmed ? 'var(--accent-muted)' : 'var(--surface-secondary)',
          borderColor: isConfirmed ? 'var(--accent-border)' : 'var(--border-subtle)',
        }"
      >
        <input
          id="confirm-recovery-saved"
          type="checkbox"
          v-model="isConfirmed"
          class="mt-0.5 rounded border-gray-400 accent-[var(--accent-primary)] cursor-pointer"
        />
        <span class="text-[12px] leading-relaxed select-none" :style="{ color: 'var(--text-secondary)' }">
          I have written down or safely backed up this recovery key in a secure offline location.
        </span>
      </label>
    </div>

    <!-- Setup Completion Status Error (preserves key) -->
    <div
      v-if="store.error"
      role="alert"
      aria-live="polite"
      class="p-3 mb-4 rounded-md border flex items-start gap-2.5 text-[12px]"
      :style="{
        background: 'var(--warning-muted)',
        borderColor: 'var(--warning)',
        color: 'var(--text-primary)',
      }"
    >
      <AlertTriangle :size="15" class="shrink-0 mt-0.5" :style="{ color: 'var(--warning)' }" />
      <span>{{ store.error }}</span>
    </div>

    <!-- Complete Action Button -->
    <div>
      <AppButton
        type="button"
        variant="gold"
        size="lg"
        class="w-full"
        :disabled="!isConfirmed || isCompleting"
        :loading="isCompleting"
        @click="handleComplete"
      >
        <span>Complete Setup & Enter Vault</span>
        <ArrowRight v-if="!isCompleting" :size="14" />
      </AppButton>
    </div>
  </div>
</template>
