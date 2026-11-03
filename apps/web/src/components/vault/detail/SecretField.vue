<script setup lang="ts">
/**
 * SecretField — the single secure presentation for any credential secret.
 *
 * Design spec §5.3. Centralises the security-relevant lifecycle that used to
 * live inline in CredentialList:
 *  - masked by default: the real secret is NEVER in the DOM while concealed;
 *  - reveal renders the value through a short blur-to-clear transition;
 *  - 30-second auto-conceal;
 *  - copy-to-clipboard with tactile feedback.
 *
 * The component owns its reveal/copy state per credential id, so switching
 * selection always resets visibility.
 */
import { onUnmounted, ref, watch } from 'vue';
import { AnimatePresence, Motion } from 'motion-v';
import { Check, Copy, Eye, EyeOff, Lock } from 'lucide-vue-next';

interface Props {
	secret: string;
	label: string;
	credentialId: string;
	autoConcealMs?: number;
}

const props = withDefaults(defineProps<Props>(), {
	autoConcealMs: 30000,
});

const revealed = ref(false);
const copied = ref(false);
let autoConcealTimer: ReturnType<typeof setTimeout> | null = null;
let copyTimer: ReturnType<typeof setTimeout> | null = null;

function clearConcealTimer(): void {
	if (autoConcealTimer) {
		clearTimeout(autoConcealTimer);
		autoConcealTimer = null;
	}
}

function clearCopyTimer(): void {
	if (copyTimer) {
		clearTimeout(copyTimer);
		copyTimer = null;
	}
}

function conceal(): void {
	revealed.value = false;
	clearConcealTimer();
}

function toggleReveal(): void {
	if (revealed.value) {
		conceal();
		return;
	}
	revealed.value = true;
	clearConcealTimer();
	autoConcealTimer = setTimeout(() => {
		revealed.value = false;
	}, props.autoConcealMs);
}

async function copySecret(): Promise<void> {
	if (!revealed.value) toggleReveal();
	try {
		await navigator.clipboard.writeText(props.secret);
		copied.value = true;
		clearCopyTimer();
		copyTimer = setTimeout(() => {
			copied.value = false;
		}, 2000);
	} catch {
		/* Clipboard access denied or unavailable: reveal already gave feedback. */
	}
}

// Switching credentials must never leave a secret exposed.
watch(
	() => props.credentialId,
	() => {
		conceal();
		copied.value = false;
		clearCopyTimer();
	},
);

onUnmounted(() => {
	clearConcealTimer();
	clearCopyTimer();
});
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-1.5">
      <p class="a-label">{{ label }}</p>
      <span class="text-[9px] font-mono tracking-[0.12em] uppercase" :style="{ color: 'var(--text-disabled)' }">
        Secret material
      </span>
    </div>

    <div
      class="rounded-xl border transition-all p-3.5"
      :style="{
        background: 'var(--surface-primary)',
        borderColor: revealed ? 'var(--gold-border)' : 'var(--border-default)',
        boxShadow: revealed
          ? 'var(--shadow-gold), var(--specular-rim-gold)'
          : 'var(--specular-rim-subtle)',
      }"
    >
      <div class="flex items-start gap-3">
        <!-- Secret value: masked state never contains the real secret -->
        <div class="flex-1 min-w-0 font-mono text-[13px] break-all select-all min-h-[2.75rem] flex items-center">
          <AnimatePresence mode="wait">
            <Motion
              v-if="revealed"
              key="revealed"
              :initial="{ opacity: 0, filter: 'blur(4px)' }"
              :animate="{ opacity: 1, filter: 'blur(0px)' }"
              :exit="{ opacity: 0, filter: 'blur(4px)' }"
              :transition="{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }"
              class="w-full text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap"
            >
              {{ secret }}
            </Motion>

            <Motion
              v-else
              key="masked"
              :initial="{ opacity: 0 }"
              :animate="{ opacity: 1 }"
              :exit="{ opacity: 0 }"
              :transition="{ duration: 0.15 }"
              class="w-full tracking-widest select-none text-[14px]"
              :style="{ color: 'var(--text-disabled)' }"
            >
              ••••••••••••••••••••••••
            </Motion>
          </AnimatePresence>
        </div>

        <!-- Reveal + copy controls -->
        <div class="flex items-center gap-1.5 shrink-0 self-center">
          <button
            type="button"
            class="p-2 rounded-md border transition-all bg-[var(--surface-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-tertiary)] hover:text-[var(--text-primary)]"
            :title="revealed ? 'Hide secret' : 'Reveal secret'"
            :aria-label="revealed ? 'Hide secret' : 'Reveal secret'"
            :aria-pressed="revealed"
            @click="toggleReveal"
          >
            <EyeOff v-if="revealed" :size="14" aria-hidden="true" />
            <Eye v-else :size="14" aria-hidden="true" />
          </button>

          <button
            type="button"
            class="p-2 rounded-md border transition-all"
            :title="copied ? 'Copied' : 'Copy secret to clipboard'"
            :aria-label="copied ? 'Copied' : 'Copy secret to clipboard'"
            :style="{
              background: copied ? 'var(--success-muted)' : 'var(--surface-secondary)',
              borderColor: copied ? 'var(--success)' : 'var(--border-subtle)',
              color: copied ? 'var(--success)' : 'var(--text-secondary)',
            }"
            @click="copySecret"
          >
            <Check v-if="copied" :size="14" aria-hidden="true" />
            <Copy v-else :size="14" aria-hidden="true" />
          </button>
        </div>
      </div>

      <p
        v-if="revealed"
        class="text-[10px] mt-2 flex items-center gap-1"
        :style="{ color: 'var(--text-tertiary)' }"
      >
        <Lock :size="10" aria-hidden="true" />
        Auto-conceals in 30 seconds for security
      </p>
    </div>
  </div>
</template>