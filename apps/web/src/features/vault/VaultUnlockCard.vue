<script setup lang="ts">
/**
 * VaultUnlockCard.vue — Master passphrase unlock card.
 *
 * Requirements:
 * - Passphrase entry using AppPasswordInput with visibility toggle
 * - Accessible errors with role="alert" and aria-live="polite"
 * - Double-submission prevention
 * - Loading state with "Deriving key..." indicator
 * - Rejection feedback motion (subtle horizontal shake on invalid attempt)
 * - Immediate in-memory clearing of passphrase upon success or unmount
 * - Secondary link to switch to emergency recovery
 */
import { ref, watch, onBeforeUnmount } from 'vue';
import { motion } from 'motion-v';
import { Lock, AlertTriangle, Key } from 'lucide-vue-next';
import { useVaultStore } from '@/stores/vaultStore';
import { useAppReducedMotion } from '@/motion/composables/useReducedMotion';
import AppPasswordInput from '@/components/ui/AppPasswordInput.vue';
import AppButton from '@/components/ui/AppButton.vue';

const emit = defineEmits<{ 'switch-to-recovery': [] }>();

const store = useVaultStore();
const { reduced } = useAppReducedMotion();

const passphrase = ref('');
const isShaking = ref(false);

async function handleUnlock() {
	if (!passphrase.value || store.isUnlocking) return;
	const success = await store.unlock(passphrase.value);
	if (success) {
		passphrase.value = '';
	} else {
		// Subtle rejection shake feedback
		if (!reduced.value) {
			isShaking.value = true;
			setTimeout(() => {
				isShaking.value = false;
			}, 400);
		}
	}
}

// Trigger shake if store reports error
watch(
	() => store.error,
	(err) => {
		if (err && !reduced.value) {
			isShaking.value = true;
			setTimeout(() => {
				isShaking.value = false;
			}, 400);
		}
	},
);

onBeforeUnmount(() => {
	passphrase.value = '';
});
</script>

<template>
  <div class="w-full">
    <!-- Header -->
    <div class="mb-6">
      <div class="flex items-center gap-2 mb-1.5">
        <Lock :size="16" :style="{ color: 'var(--accent-primary)' }" />
        <h2 class="a-subheading font-semibold" :style="{ color: 'var(--text-primary)' }">
          Unlock Vault
        </h2>
      </div>
      <p class="a-supporting" :style="{ color: 'var(--text-tertiary)' }">
        Enter your master passphrase to decrypt and unlock credentials.
      </p>
    </div>

    <!-- Error Alert -->
    <div
      v-if="store.error"
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
      <span>{{ store.error }}</span>
    </div>

    <!-- Unlock Form with subtle shake on rejection -->
    <motion.form
      @submit.prevent="handleUnlock"
      class="space-y-4"
      :animate="isShaking ? { x: [-6, 6, -4, 4, -2, 2, 0] } : { x: 0 }"
      :transition="{ duration: 0.38 }"
    >
      <div>
        <AppPasswordInput
          id="unlock-passphrase"
          v-model="passphrase"
          label="Master Passphrase"
          placeholder="Enter master passphrase"
          autocomplete="current-password"
          :autofocus="true"
          :disabled="store.isUnlocking"
          :error="store.error ? store.error : undefined"
        />
      </div>

      <div class="pt-1">
        <AppButton
          type="submit"
          variant="gold"
          size="lg"
          class="w-full"
          :loading="store.isUnlocking"
          :disabled="!passphrase || store.isUnlocking"
        >
          {{ store.isUnlocking ? 'Deriving key...' : 'Unlock Vault' }}
        </AppButton>
      </div>
    </motion.form>

    <!-- Switch to recovery link -->
    <div class="mt-5 pt-4 border-t text-center" :style="{ borderColor: 'var(--border-subtle)' }">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors cursor-pointer"
        :style="{ color: 'var(--text-tertiary)' }"
        @mouseenter="($event.target as HTMLElement).style.color = 'var(--accent-primary)'"
        @mouseleave="($event.target as HTMLElement).style.color = 'var(--text-tertiary)'"
        @click="emit('switch-to-recovery')"
      >
        <Key :size="12" />
        <span>Lost your passphrase? Use recovery key</span>
      </button>
    </div>
  </div>
</template>
