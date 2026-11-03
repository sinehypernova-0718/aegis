<script setup lang="ts">
/**
 * SshKeyDetail — SSH-key-specific presentation (design spec §5.3).
 *
 * A cryptographic asset deserves more than a generic form: algorithm,
 * SHA-256 fingerprint, passphrase state and the copyable public key are
 * surfaced as first-class information, while the private key stays in
 * SecretField.
 */
import { computed, onUnmounted, ref } from 'vue';
import { Check, Copy, Fingerprint, KeyRound, ShieldCheck, ShieldAlert } from 'lucide-vue-next';
import type { CredentialDetail } from '@/types';

const props = defineProps<{ credential: CredentialDetail }>();

const meta = computed(() => props.credential.sshKeyMetadata);
const algorithm = computed(() => (meta.value?.keyType ?? 'ed25519').toUpperCase());
const passphraseProtected = computed(() => meta.value?.passphraseProtected === true);

const copiedPublicKey = ref(false);
let copyTimer: ReturnType<typeof setTimeout> | null = null;

async function copyPublicKey(): Promise<void> {
	const publicKey = meta.value?.publicKey;
	if (!publicKey) return;
	try {
		await navigator.clipboard.writeText(publicKey);
		copiedPublicKey.value = true;
		if (copyTimer) clearTimeout(copyTimer);
		copyTimer = setTimeout(() => {
			copiedPublicKey.value = false;
		}, 2000);
	} catch {
		/* Clipboard unavailable: the key remains selectable below. */
	}
}

onUnmounted(() => {
	if (copyTimer) clearTimeout(copyTimer);
});
</script>

<template>
  <section
    v-if="meta"
    class="rounded-xl border p-4 space-y-4"
    :style="{ background: 'var(--surface-primary)', borderColor: 'var(--border-subtle)' }"
  >
    <div class="flex items-center gap-2">
      <KeyRound :size="14" :style="{ color: 'var(--gold)' }" aria-hidden="true" />
      <h3 class="a-heading text-[13px]">SSH Key Specifications</h3>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div class="rounded-lg border p-3" :style="{ borderColor: 'var(--border-subtle)', background: 'var(--surface-secondary)' }">
        <p class="a-label mb-1">Algorithm</p>
        <p class="font-mono text-[13px]" :style="{ color: 'var(--text-primary)' }">{{ algorithm }}</p>
      </div>

      <div class="rounded-lg border p-3" :style="{ borderColor: 'var(--border-subtle)', background: 'var(--surface-secondary)' }">
        <p class="a-label mb-1">Passphrase</p>
        <p class="flex items-center gap-1.5 text-[12px] font-medium" :style="{ color: passphraseProtected ? 'var(--success)' : 'var(--warning)' }">
          <ShieldCheck v-if="passphraseProtected" :size="13" aria-hidden="true" />
          <ShieldAlert v-else :size="13" aria-hidden="true" />
          {{ passphraseProtected ? 'Protected' : 'Not protected' }}
        </p>
      </div>
    </div>

    <div v-if="meta.fingerprint" class="space-y-1">
      <p class="a-label flex items-center gap-1.5">
        <Fingerprint :size="11" aria-hidden="true" />
        SHA-256 fingerprint
      </p>
      <p
        class="rounded-lg border px-2.5 py-2 text-[11px] font-mono break-all"
        :style="{ background: 'var(--surface-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }"
      >
        {{ meta.fingerprint }}
      </p>
    </div>

    <div v-if="meta.publicKey" class="space-y-1">
      <div class="flex items-center justify-between gap-2">
        <p class="a-label">Public key</p>
        <button
          type="button"
          class="flex items-center gap-1 text-[11px] font-medium transition-colors"
          :style="{ color: 'var(--gold)' }"
          :aria-label="copiedPublicKey ? 'Public key copied' : 'Copy public key'"
          @click="copyPublicKey"
        >
          <Check v-if="copiedPublicKey" :size="11" aria-hidden="true" />
          <Copy v-else :size="11" aria-hidden="true" />
          {{ copiedPublicKey ? 'Copied' : 'Copy' }}
        </button>
      </div>
      <p
        class="rounded-lg border px-2.5 py-2 text-[11px] font-mono break-all"
        :style="{ background: 'var(--surface-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }"
      >
        {{ meta.publicKey }}
      </p>
    </div>
  </section>
</template>