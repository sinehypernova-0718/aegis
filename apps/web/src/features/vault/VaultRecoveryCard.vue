<script setup lang="ts">
/**
 * VaultRecoveryCard.vue — Emergency Recovery key entry.
 *
 * Requirements:
 * - Monospace recovery key entry
 * - Clean uppercase format handling
 * - Double-submission prevention
 * - Accessible error and warning display
 * - Safe cancellation state (returns to master passphrase entry)
 * - Immediate in-memory clearing of recovery key upon success, cancellation, or unmount
 */
import { ref, onBeforeUnmount } from 'vue';
import { Key, AlertTriangle, ShieldCheck, ArrowLeft, ArrowRight } from 'lucide-vue-next';
import { useVaultStore } from '@/stores/vaultStore';
import AppInput from '@/components/ui/AppInput.vue';
import AppButton from '@/components/ui/AppButton.vue';

const emit = defineEmits<{ 'cancel-recovery': [] }>();

const store = useVaultStore();
const recoveryKey = ref('');

function onKeyInput(val: string) {
	// Normalize key formatting: uppercase, trimmed
	recoveryKey.value = val.toUpperCase();
}

async function handleRecover() {
	const cleaned = recoveryKey.value.trim();
	if (!cleaned || store.isRecovering) return;
	const success = await store.recover(cleaned);
	if (success) {
		recoveryKey.value = '';
	}
}

function handleCancel() {
	recoveryKey.value = '';
	store.error = null;
	emit('cancel-recovery');
}

onBeforeUnmount(() => {
	recoveryKey.value = '';
});
</script>

<template>
  <div class="w-full">
    <!-- Header -->
    <div class="mb-5">
      <div class="flex items-center gap-2 mb-1.5">
        <Key :size="16" :style="{ color: 'var(--gold)' }" />
        <h2 class="a-subheading font-semibold" :style="{ color: 'var(--text-primary)' }">
          Emergency Recovery Mode
        </h2>
      </div>
      <p class="a-supporting" :style="{ color: 'var(--text-tertiary)' }">
        Enter the emergency recovery key provisioned during vault creation to restore access.
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

    <!-- Recovery Form -->
    <form @submit.prevent="handleRecover" class="space-y-4">
      <div>
        <AppInput
          id="recovery-key-input"
          v-model="recoveryKey"
          label="Recovery Key"
          placeholder="e.g. AEGIS-RCV-XXXX-XXXX-XXXX"
          autocomplete="off"
          :autofocus="true"
          :disabled="store.isRecovering"
          class="font-mono"
          @update:modelValue="onKeyInput"
        />
        <p class="mt-1.5 text-[11px]" :style="{ color: 'var(--text-disabled)' }">
          Paste or type the complete key including hyphens and prefix.
        </p>
      </div>

      <div class="pt-1 flex flex-col gap-2.5">
        <AppButton
          type="submit"
          variant="gold"
          size="lg"
          class="w-full"
          :loading="store.isRecovering"
          :disabled="!recoveryKey.trim() || store.isRecovering"
        >
          <span>{{ store.isRecovering ? 'Restoring Access...' : 'Recover Vault' }}</span>
          <ArrowRight v-if="!store.isRecovering" :size="14" />
        </AppButton>

        <AppButton
          type="button"
          variant="secondary"
          size="md"
          class="w-full"
          :disabled="store.isRecovering"
          @click="handleCancel"
        >
          <ArrowLeft :size="13" />
          <span>Cancel & Back to Passphrase</span>
        </AppButton>
      </div>
    </form>

    <!-- Backend advisory -->
    <div
      class="mt-6 pt-4 border-t flex items-center gap-2 text-[11px]"
      :style="{ borderColor: 'var(--border-subtle)', color: 'var(--text-disabled)' }"
    >
      <ShieldCheck :size="13" class="shrink-0" :style="{ color: 'var(--gold)' }" />
      <span>Cryptographic recovery operates through the authenticated vault client.</span>
    </div>
  </div>
</template>
