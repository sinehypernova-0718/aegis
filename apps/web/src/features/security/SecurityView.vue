<script setup lang="ts">
/**
 * SecurityView — session and security status.
 *
 * Layout:
 *  - Session status: current state, session age, and auto-lock display.
 *  - Security posture: individually explained indicators. Each indicator
 *    states exactly what the real backend guarantees today (Argon2id +
 *    XChaCha20-Poly1305, authoritative sessions, recovery envelopes) and
 *    flags the one remaining gap (the device-stored auto-lock preference is
 *    not wired to the backend's idle-lock authority).
 *  - Protection model: sticky storytelling composition (the explainer panel
 *    holds while three assurance steps scroll past on large screens;
 *    stacks vertically on tablet and mobile).
 *  - Recovery guidance.
 *  - Lock now action.
 *
 * Constraints honoured:
 *  - No numerical "security score" — only individually labelled indicators.
 *  - Auto-lock timeout displayed as the device-stored preference, with the
 *    backend's independent idle-lock window called out.
 *  - Locking clears sensitive state immediately; no animation gate.
 *  - No fake backend operations implied.
 */
import { computed } from 'vue';
import {
	Shield,
	Lock,
	Key,
	CheckCircle2,
	AlertCircle,
	Clock,
	Database,
	ShieldOff,
} from 'lucide-vue-next';
import { useVaultStore } from '@/stores/vaultStore';
import { useSessionPreferences } from '@/composables/useSessionPreferences';
import PageContainer from '@/components/layout/PageContainer.vue';
import PageHeader from '@/components/layout/PageHeader.vue';
import Card from '@/components/ui/Card.vue';
import Section from '@/components/layout/Section.vue';
import KeyValue from '@/components/ui/KeyValue.vue';
import AppButton from '@/components/ui/AppButton.vue';
import {
	MotionReveal,
	MotionStagger,
	MotionStaggerItem,
	ScrollProgressBar,
} from '@/motion/components';
import { pageScroller } from '@/motion/composables/useScrollContainer';
import { staggers } from '@/motion/tokens';
import { formatRelativeTime } from '@/utils/relativeTime';

const store = useVaultStore();

/**
 * Shared session-preference state — the same singleton refs the Settings
 * view edits, so the displayed auto-lock value always matches the current
 * selection instead of a hardcoded constant.
 */
const { autoLockLabel } = useSessionPreferences();

/**
 * Individual security indicators — each carries its own explanation and an
 * honest note distinguishing backend-enforced guarantees from device-local
 * state. No aggregate score is derived from these.
 */
const indicators = computed(() => [
	{
		id: 'session',
		label: 'Active session',
		description: 'The vault is currently unlocked and accessible.',
		status: store.isUnlocked ? 'ok' : 'warn',
		note: null,
	},
	{
		id: 'local-first',
		label: 'Local-first storage',
		description:
			'Credentials are stored in your local environment. The frontend never holds encryption keys.',
		status: 'ok' as const,
		note: null,
	},
	{
		id: 'autolock',
		label: 'Auto-lock timeout',
		// Reflects the shared session-preference state (editable in Settings).
		description: `Device-stored preference is set to ${autoLockLabel.value}.`,
		status: 'warn' as const,
		note: 'The backend enforces idle auto-lock independently (5 minutes by default, AEGIS_IDLE_TIMEOUT_MS); this preference is not wired to that authority yet.',
	},
	{
		id: 'clipboard',
		label: 'Clipboard hygiene',
		description: 'Copied secrets are not written to permanent storage by this application.',
		status: 'ok' as const,
		note: "The operating system clipboard is outside this application's control.",
	},
	{
		id: 'backend-crypto',
		label: 'Cryptographic operations',
		description:
			'All KDF, encryption, and decryption operations are performed by the backend service (Argon2id + XChaCha20-Poly1305). The frontend never touches key material.',
		status: 'info' as const,
		note: null,
	},
	{
		id: 'recovery',
		label: 'Recovery key configured',
		description: 'A recovery key was issued by the backend at vault creation and shown exactly once.',
		status: 'info' as const,
		note: 'Recovery unlock verifies the key against its dedicated key envelope server-side; the backend stores no readable copy of the key.',
	},
]);

/** The three assurances shown alongside the sticky explainer. */
const protections = [
	{
		title: 'Local-first storage',
		body: 'Credentials live in your own environment. The frontend never owns encryption keys.',
	},
	{
		title: 'Authoritative sessions',
		body: 'Backend verification decides unlock and lock outcomes — the UI only reports them.',
	},
	{
		title: 'Immediate locking',
		body: 'Locking clears sensitive state instantly; animation never delays securing the vault.',
	},
];
</script>

<template>
  <PageContainer>
    <template #sticky-title>
      <span class="text-[11px] font-medium tracking-[0.08em] uppercase text-[var(--text-tertiary)]">
        Security
      </span>
    </template>

    <ScrollProgressBar :container="pageScroller" />

    <!-- Header -->
    <MotionReveal tag="header" :distance="12" :once="true">
      <PageHeader
        title="Security"
        description="Vault session status and security posture"
      />
    </MotionReveal>

    <!-- Session Status -->
    <MotionReveal :once="true" :amount="0.2">
      <Card padding="md">
        <Section title="Session Status" :icon="Shield">
          <div class="space-y-2.5">
            <KeyValue label="State">
              <span class="flex items-center gap-1.5 text-[11px] font-medium"
                :style="{ color: store.isUnlocked ? 'var(--success)' : 'var(--danger)' }">
                <span
                  class="w-1.5 h-1.5 rounded-full"
                  :style="{ background: store.isUnlocked ? 'var(--success)' : 'var(--danger)' }"
                />
                {{ store.isUnlocked ? 'Unlocked & Active' : 'Locked' }}
              </span>
            </KeyValue>
            <KeyValue label="Unlocked">
              <span class="text-[11px] tabular-nums text-[var(--text-primary)]">
                {{ store.status.lastUnlockedAt
                    ? formatRelativeTime(store.status.lastUnlockedAt, { compact: true }) + ' ago'
                    : '—' }}
              </span>
            </KeyValue>
            <KeyValue label="Auto-lock preference">
              <span class="flex items-center gap-1.5">
                <span class="text-[11px] tabular-nums text-[var(--text-primary)]">{{ autoLockLabel }}</span>
                <span
                  class="text-[9px] font-mono px-1 py-0.5 rounded"
                  :style="{ color: 'var(--success)', background: 'var(--success-muted)' }"
                >
                  SAVED
                </span>
              </span>
            </KeyValue>
            <KeyValue label="Vault ID">
              <span class="text-[10px] font-mono text-[var(--text-tertiary)] max-w-[140px] truncate">
                {{ store.status.vaultId ?? '—' }}
              </span>
            </KeyValue>
          </div>
        </Section>
      </Card>
    </MotionReveal>

    <!-- Security indicators (per-item, no aggregate score) -->
    <MotionReveal :once="true" :amount="0.15">
      <Card padding="md">
        <Section title="Security Posture" :icon="Shield">
          <p class="text-[11px] text-[var(--text-tertiary)] -mt-1 mb-3">
            Individual security properties — each is explained separately. No aggregate
            score is derived because individual context matters more than a single number.
          </p>

          <div class="space-y-2">
            <div
              v-for="ind in indicators"
              :key="ind.id"
              class="flex items-start gap-3 p-3 rounded-lg border"
              :style="{
                background: ind.status === 'ok'
                  ? 'var(--success-muted)'
                  : ind.status === 'warn'
                  ? 'var(--warning-muted)'
                  : 'var(--surface-secondary)',
                borderColor: ind.status === 'ok'
                  ? 'var(--success)' + '35'
                  : ind.status === 'warn'
                  ? 'var(--warning)' + '35'
                  : 'var(--border-subtle)',
              }"
            >
              <!-- Icon -->
              <div class="shrink-0 mt-0.5">
                <CheckCircle2
                  v-if="ind.status === 'ok'"
                  :size="14"
                  :style="{ color: 'var(--success)' }"
                />
                <AlertCircle
                  v-else-if="ind.status === 'warn'"
                  :size="14"
                  :style="{ color: 'var(--warning)' }"
                />
                <Database
                  v-else
                  :size="14"
                  :style="{ color: 'var(--text-tertiary)' }"
                />
              </div>

              <!-- Text -->
              <div class="flex-1 min-w-0">
                <p class="text-[12px] font-medium text-[var(--text-primary)]">{{ ind.label }}</p>
                <p class="text-[11px] mt-0.5 leading-relaxed text-[var(--text-tertiary)]">{{ ind.description }}</p>
                <!-- Per-indicator scope note -->
                <p
                  v-if="ind.note"
                  class="text-[10px] mt-1 italic"
                  :style="{ color: 'var(--text-disabled)' }"
                >
                  {{ ind.note }}
                </p>
              </div>
            </div>
          </div>
        </Section>
      </Card>
    </MotionReveal>

    <!-- Sticky protection storytelling: stacks on mobile, side-by-side on large screens -->
    <div class="grid grid-cols-1 lg:grid-cols-5 gap-5">
      <div class="lg:col-span-2">
        <div class="lg:sticky lg:top-16">
          <MotionReveal :once="true" :cinematic="true" :amount="0.3">
            <Card padding="md">
              <Section title="How Aegis Protects You" :icon="Shield">
                <p class="text-[12px] leading-relaxed text-[var(--text-secondary)]">
                  Aegis treats every session as temporary and every secret as
                  borrowed. These are the design guarantees that hold while the vault
                  is open — scroll through them beside this panel.
                </p>
                <p class="text-[10px] mt-3 italic text-[var(--text-disabled)]">
                  Real wiring: unlock, idle auto-lock, lock, encrypted storage, and recovery all
                  execute in the local Aegis backend — the UI reports outcomes only.
                </p>
              </Section>
            </Card>
          </MotionReveal>
        </div>
      </div>

      <MotionStagger class="lg:col-span-3 space-y-4" :interval="staggers.section" when="view" :delay-children="0">
        <MotionStaggerItem v-for="(p, i) in protections" :key="p.title" :distance="20">
          <Card padding="md">
            <div class="flex items-start gap-3">
              <div
                class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-[11px] font-semibold tabular-nums"
                :style="{
                  background: 'var(--gold-surface)',
                  color: 'var(--gold)',
                  border: '1px solid var(--gold-border)',
                  boxShadow: 'var(--specular-rim-gold)',
                }"
              >
                {{ i + 1 }}
              </div>
              <div>
                <p class="text-[13px] font-medium text-[var(--text-primary)]">{{ p.title }}</p>
                <p class="text-[11px] mt-1 leading-relaxed text-[var(--text-tertiary)]">{{ p.body }}</p>
              </div>
            </div>
          </Card>
        </MotionStaggerItem>
      </MotionStagger>
    </div>

    <!-- Lock now -->
    <MotionReveal :once="true" :amount="0.25">
      <Card padding="md">
        <div class="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p class="text-[13px] font-medium text-[var(--text-primary)]">Lock Vault</p>
            <p class="text-[11px] text-[var(--text-tertiary)] mt-0.5">
              Immediately end the session and clear all sensitive state
            </p>
          </div>
          <!-- store.lock() runs synchronously on click; sensitive state is
               cleared before any exit animation begins. -->
          <AppButton variant="danger" size="sm" @click="store.lock()">
            <Lock :size="12" />
            Lock Now
          </AppButton>
        </div>
      </Card>
    </MotionReveal>

    <!-- Recovery guidance -->
    <MotionReveal :once="true" :amount="0.25">
      <Card padding="md">
        <Section title="Recovery" :icon="Key">
          <div
            class="p-3 rounded-md border"
            :style="{
              background: 'var(--warning-muted)',
              borderColor: 'var(--warning)' + '30',
            }"
          >
            <p class="text-[12px] text-[var(--text-secondary)]">
              Your recovery key is an emergency backup for when you forget your master passphrase.
              Store it securely offline — never digitally alongside the vault itself.
            </p>
            <p class="text-[10px] mt-2 italic text-[var(--text-disabled)]">
              Recovery unlock is supported by the backend: the key is verified against its own key
              envelope with server-side Argon2id, and no readable copy of it is ever stored. If you
              lose both the passphrase and the key, the vault contents cannot be recovered.
            </p>
          </div>
        </Section>
      </Card>
    </MotionReveal>
  </PageContainer>
</template>
