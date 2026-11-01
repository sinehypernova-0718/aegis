<script setup lang="ts">
/**
 * VaultSetupCard.vue — First-run vault initialization.
 *
 * Responsibilities:
 * - Master passphrase creation & confirmation
 * - Real-time validation (minimum 12 characters, matching confirmation)
 * - Refined passphrase validation feedback & strength indicator
 * - Accessible error display
 * - Double submission prevention & loading state
 * - Strict memory hygiene: clears sensitive values on success or unmount
 */
import { ref, computed, onBeforeUnmount } from 'vue';
import { motion, AnimatePresence } from 'motion-v';
import { KeyRound, AlertTriangle, ShieldCheck, Check, ArrowRight } from 'lucide-vue-next';
import { useVaultStore } from '@/stores/vaultStore';
import AppPasswordInput from '@/components/ui/AppPasswordInput.vue';
import AppButton from '@/components/ui/AppButton.vue';

const store = useVaultStore();

const passphrase = ref('');
const confirmPassphrase = ref('');
const localError = ref<string | null>(null);

const hasMinLength = computed(() => passphrase.value.length >= 12);
const hasMatch = computed(
	() => confirmPassphrase.value.length > 0 && passphrase.value === confirmPassphrase.value,
);
const hasMismatch = computed(
	() => confirmPassphrase.value.length > 0 && passphrase.value !== confirmPassphrase.value,
);

// Refined strength calculation
const strengthLevel = computed(() => {
	const p = passphrase.value;
	if (p.length === 0) return { score: 0, label: 'Empty', color: 'var(--text-disabled)' };
	if (p.length < 12) return { score: 1, label: 'Too short (min 12)', color: 'var(--danger)' };

	let score = 2;
	const hasUpper = /[A-Z]/.test(p);
	const hasLower = /[a-z]/.test(p);
	const hasNumber = /[0-9]/.test(p);
	const hasSymbol = /[^A-Za-z0-9]/.test(p);

	const diversity = [hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length;
	if (p.length >= 16 && diversity >= 3) {
		score = 4;
	} else if (p.length >= 14 || diversity >= 2) {
		score = 3;
	}

	switch (score) {
		case 2:
			return { score: 2, label: 'Fair', color: 'var(--warning)' };
		case 3:
			return { score: 3, label: 'Good', color: 'var(--success)' };
		case 4:
			return { score: 4, label: 'Strong (Recommended)', color: 'var(--gold)' };
		default:
			return { score: 1, label: 'Weak', color: 'var(--danger)' };
	}
});

const isFormValid = computed(() => hasMinLength.value && hasMatch.value);

async function handleSubmit() {
	localError.value = null;

	if (!hasMinLength.value) {
		localError.value = 'Passphrase must be at least 12 characters.';
		return;
	}
	if (!hasMatch.value) {
		localError.value = 'Passphrases do not match.';
		return;
	}
	if (store.isCreating) return;

	const result = await store.setupVault(passphrase.value, confirmPassphrase.value);
	if (result.success) {
		passphrase.value = '';
		confirmPassphrase.value = '';
	}
}

onBeforeUnmount(() => {
	passphrase.value = '';
	confirmPassphrase.value = '';
	localError.value = null;
});
</script>

<template>
  <div class="w-full">
    <!-- Header -->
    <div class="mb-6">
      <div class="flex items-center gap-2 mb-1.5">
        <KeyRound :size="16" :style="{ color: 'var(--gold)' }" />
        <h2 class="a-subheading font-semibold" :style="{ color: 'var(--text-primary)' }">
          Create Master Passphrase
        </h2>
      </div>
      <p class="a-supporting" :style="{ color: 'var(--text-tertiary)' }">
        Your master passphrase is submitted directly to the local backend service for key derivation and vault verification. It cannot be reset without an emergency recovery key.
      </p>
    </div>

    <!-- Active Error Display -->
    <div
      v-if="store.error || localError"
      role="alert"
      aria-live="polite"
      class="p-3 mb-5 rounded-md border flex items-start gap-2.5 text-[12px]"
      :style="{
        background: 'var(--danger-muted)',
        borderColor: 'var(--danger)',
        color: 'var(--danger)',
      }"
    >
      <AlertTriangle :size="15" class="shrink-0 mt-0.5" />
      <span>{{ localError || store.error }}</span>
    </div>

    <!-- Form -->
    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div>
        <AppPasswordInput
          id="setup-passphrase"
          v-model="passphrase"
          label="Master Passphrase"
          placeholder="At least 12 characters"
          autocomplete="new-password"
          :autofocus="true"
          :disabled="store.isCreating"
        />

        <!-- Strength Indicator Bar -->
        <div v-if="passphrase.length > 0" class="mt-2.5 space-y-1.5">
          <div class="flex items-center justify-between text-[11px]">
            <span class="text-[var(--text-tertiary)]">Passphrase Strength</span>
            <span class="font-medium" :style="{ color: strengthLevel.color }">
              {{ strengthLevel.label }}
            </span>
          </div>

          <!-- Segmented meter -->
          <div class="grid grid-cols-4 gap-1.5 h-1 w-full bg-[var(--surface-input)] rounded-full overflow-hidden">
            <div
              v-for="seg in 4"
              :key="seg"
              class="h-full rounded-full transition-all duration-300"
              :style="{
                background: seg <= strengthLevel.score ? strengthLevel.color : 'transparent',
                opacity: seg <= strengthLevel.score ? 1 : 0.2,
              }"
            />
          </div>
        </div>

        <!-- Requirements Helper -->
        <div class="mt-2 flex items-center gap-2 text-[11px]" :style="{ color: hasMinLength ? 'var(--success)' : 'var(--text-disabled)' }">
          <Check v-if="hasMinLength" :size="12" class="shrink-0" />
          <span v-else class="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
          <span>Minimum 12 characters ({{ passphrase.length }}/12)</span>
        </div>
      </div>

      <div>
        <AppPasswordInput
          id="setup-confirm-passphrase"
          v-model="confirmPassphrase"
          label="Confirm Master Passphrase"
          placeholder="Re-enter your master passphrase"
          autocomplete="new-password"
          :error="hasMismatch ? 'Passphrases do not match' : undefined"
          :disabled="store.isCreating"
        />
        <div
          v-if="hasMatch"
          class="mt-1.5 flex items-center gap-1.5 text-[11px]"
          :style="{ color: 'var(--success)' }"
        >
          <Check :size="12" />
          <span>Passphrases match</span>
        </div>
      </div>

      <div class="pt-2">
        <AppButton
          type="submit"
          variant="gold"
          size="lg"
          class="w-full"
          :loading="store.isCreating"
          :disabled="!isFormValid || store.isCreating"
        >
          <span>{{ store.isCreating ? 'Initializing Vault...' : 'Create Vault & Continue' }}</span>
          <ArrowRight v-if="!store.isCreating" :size="14" />
        </AppButton>
      </div>
    </form>

    <!-- Security notice -->
    <div
      class="mt-6 pt-4 border-t flex items-center gap-2 text-[11px]"
      :style="{ borderColor: 'var(--border-subtle)', color: 'var(--text-disabled)' }"
    >
      <ShieldCheck :size="13" class="shrink-0" :style="{ color: 'var(--accent-primary)' }" />
      <span>Local backend boundary: KDF, key unwrapping, and cryptographic sessions remain in the backend service.</span>
    </div>
  </div>
</template>
