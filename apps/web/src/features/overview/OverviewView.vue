<script setup lang="ts">
/**
 * OverviewView — Vault dashboard.
 *
 * Motion choreography (Layer 03 scroll + Layer 04 interaction):
 *  - ScrollProgressBar and decorative parallax composition bound to
 *    the nested scroll container registered by PageContainer.
 *  - Header + hero stat cards enter on a mount-driven stagger.
 *  - Stat cards are interactive surfaces: hover lift + press compression.
 *  - Main content sections reveal smoothly on scroll viewport entry.
 *  - Activity rows stagger in when scrolled into view, capped so long
 *    lists never leave tail items waiting.
 */

import {
	Activity,
	ArrowRight,
	Clock,
	FileText,
	Fingerprint,
	Globe,
	Key,
	Lock,
	Plus,
	Shield,
	ShieldCheck,
	Terminal,
} from 'lucide-vue-next';
import { motion } from 'motion-v';
import { computed } from 'vue';
import Grid from '@/components/layout/Grid.vue';
import PageContainer from '@/components/layout/PageContainer.vue';
import PageHeader from '@/components/layout/PageHeader.vue';
import Section from '@/components/layout/Section.vue';
import AppBadge from '@/components/ui/AppBadge.vue';
import AppButton from '@/components/ui/AppButton.vue';
import Card from '@/components/ui/Card.vue';
import { useSessionPreferences } from '@/composables/useSessionPreferences';
import {
	MotionReveal,
	MotionStagger,
	MotionStaggerItem,
	ParallaxLayer,
	ScrollProgressBar,
} from '@/motion/components';
import { pageScroller } from '@/motion/composables/useScrollContainer';
import { cardInteraction } from '@/motion/presets';
import { cappedStaggerDelay, staggers } from '@/motion/tokens';
import { useVaultStore } from '@/stores/vaultStore';
import type { CredentialKind } from '@/types';

const store = useVaultStore();
const { autoLockLabel } = useSessionPreferences();

/** Dev-only caption: the mock adapter serves synthetic activity, so the UI
 *  says so honestly; the caption is absent from production builds. */
const isDev = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);

const stats = computed(() => {
	const count = (reported: number | undefined, loadedFallback: number) =>
		reported ??
		(store.credentialCountsLoaded ? loadedFallback : store.credentialCountsLoading ? '…' : '—');
	const sshAndOauth =
		store.status.sshKeyCount !== undefined || store.status.oauth2Count !== undefined
			? (store.status.sshKeyCount ?? 0) + (store.status.oauth2Count ?? 0)
			: store.credentialCountsLoaded
				? store.credentials.filter((item) => item.kind === 'ssh-key' || item.kind === 'oauth2')
						.length
				: store.credentialCountsLoading
					? '…'
					: '—';

	// Total first: the primary figure carries the most visual weight, the
	// per-kind counts read as its breakdown (design spec §5.4).
	return [
		{
			label: 'Total Credentials',
			value: count(store.status.credentialCount, store.credentials.length),
			icon: Lock,
			color: 'var(--accent-primary)',
			page: 'passwords' as const,
		},
		{
			label: 'Passwords',
			value: count(store.status.passwordCount, store.passwords.length),
			icon: Key,
			color: 'var(--type-password)',
			page: 'passwords' as const,
		},
		{
			label: 'API Keys & Tokens',
			value: count(store.status.apiKeyCount, store.apiKeys.length),
			icon: Fingerprint,
			color: 'var(--type-api-key)',
			page: 'api-keys' as const,
		},
		{
			label: 'SSH & OAuth2',
			value: sshAndOauth,
			icon: Terminal,
			color: 'var(--gold)',
			page: 'passwords' as const,
		},
	];
});

function getEventIcon(k?: CredentialKind) {
	switch (k) {
		case 'password':
			return Key;
		case 'api-key':
			return Fingerprint;
		case 'access-token':
			return Shield;
		case 'ssh-key':
			return Terminal;
		case 'oauth2':
			return Globe;
		case 'secure-note':
			return FileText;
		default:
			return Clock;
	}
}

function getEventColor(k?: CredentialKind) {
	switch (k) {
		case 'password':
			return 'var(--type-password)';
		case 'api-key':
			return 'var(--type-api-key)';
		case 'access-token':
			return 'var(--type-token)';
		case 'ssh-key':
			return 'var(--type-ssh-key)';
		case 'oauth2':
			return 'var(--gold)';
		case 'secure-note':
			return 'var(--warning)';
		default:
			return 'var(--accent-primary)';
	}
}

function formatTimeAgo(dateStr: string): string {
	const date = new Date(dateStr);
	const now = new Date();
	const diff = now.getTime() - date.getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return 'just now';
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days}d ago`;
	return date.toLocaleDateString();
}
</script>

<template>
  <PageContainer>
    <template #sticky-title>
      <span class="text-[11px] font-medium tracking-[0.08em] uppercase text-[var(--text-tertiary)]">
        Vault Overview
      </span>
    </template>

    <!-- Scroll-linked progress bar -->
    <ScrollProgressBar :container="pageScroller" />

    <!-- Decorative atmospheric parallax composition -->
    <div class="relative">
      <ParallaxLayer :container="pageScroller" :distance="-60" class="pointer-events-none">
        <div
          class="absolute -top-12 right-4 w-[380px] h-[380px] rounded-full opacity-40"
          :style="{ background: 'var(--accent-muted)', filter: 'blur(100px)' }"
          aria-hidden="true"
        />
      </ParallaxLayer>

      <ParallaxLayer :container="pageScroller" :distance="28" class="pointer-events-none">
        <div
          class="absolute top-20 -left-12 w-[220px] h-[220px] rotate-45 border opacity-30"
          :style="{ borderColor: 'var(--gold-border)', borderRadius: '28px' }"
          aria-hidden="true"
        />
      </ParallaxLayer>

      <!-- Mount-driven Staggered Header & Stat Cards -->
      <MotionStagger :interval="staggers.section" when="mount">
        <MotionStaggerItem>
          <PageHeader
            title="Vault Overview"
            description="Your premium local-first credential vault at a glance"
          >
            <template #actions>
              <div class="flex items-center gap-2">
                <AppButton variant="gold" size="sm" @click="store.openCreateModal()">
                  <Plus :size="13" />
                  <span>New Credential</span>
                </AppButton>
              </div>
            </template>
          </PageHeader>
        </MotionStaggerItem>

        <!-- 4-Stat Cards Grid with Tactile Motion Interaction -->
        <MotionStaggerItem>
          <Grid :cols="4" gap="sm">
            <motion.button
              v-for="(stat, i) in stats"
              :key="stat.label"
              type="button"
              @click="store.navigate(stat.page)"
              v-bind="cardInteraction"
              class="a-glass a-glass--interactive p-4 rounded-lg text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-border-focus)] transition-all"
              :class="i === 0 ? 'a-glass--gold' : 'a-glass--standard'"
            >
              <div class="flex items-center justify-between mb-2.5">
                <div
                  class="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                  :style="{
                    background: `${stat.color}16`,
                    border: `1px solid ${stat.color}35`,
                  }"
                >
                  <component :is="stat.icon" :size="13" :style="{ color: stat.color }" />
                </div>
                <ArrowRight :size="12" class="opacity-0 group-hover:opacity-100 text-[var(--text-tertiary)] transition-opacity" />
              </div>

              <p
                class="font-semibold tracking-tight leading-none text-[var(--text-primary)] font-mono"
                :class="i === 0 ? 'text-[34px]' : 'text-[24px]'"
              >
                {{ stat.value }}
              </p>
              <p
                class="font-medium mt-1.5"
                :class="i === 0 ? 'text-[12px] text-[var(--text-secondary)]' : 'text-[11px] text-[var(--text-tertiary)]'"
              >
                {{ stat.label }}
              </p>
            </motion.button>
          </Grid>
        </MotionStaggerItem>
      </MotionStagger>
    </div>

    <!-- Main Content: Viewport-triggered Scroll Reveal -->
    <MotionReveal :once="true" :amount="0.12" class="mt-6">
      <Grid :cols="3" gap="sm">
        <!-- Recent Activity Feed (2 Cols on lg+, full width otherwise) -->
        <div class="col-span-1 sm:col-span-2 lg:col-span-2">
          <Card padding="sm">
            <Section title="Recent Activity" :icon="Activity">
              <div v-if="store.activity.length === 0" class="py-6 text-center">
                <p class="text-[12px] text-[var(--text-tertiary)]">
                  No recent activity logged
                </p>
              </div>

              <!-- Staggered rows as group enters viewport -->
              <MotionStagger
                v-else
                :interval="staggers.item"
                :delay-children="0.04"
                when="view"
                tag="div"
                class="space-y-1"
              >
                <MotionStaggerItem
                  v-for="(evt, i) in store.activity.slice(0, 8)"
                  :key="evt.id"
                  tag="div"
                  :distance="6"
                >
                  <div
                    class="flex items-start gap-2.5 py-2 px-2.5 rounded-md border transition-all hover:bg-[var(--surface-secondary)] border-transparent hover:border-[var(--border-subtle)]"
                    :style="{ transitionDelay: `${cappedStaggerDelay(i)}s` }"
                  >
                    <!-- Type icon -->
                    <div
                      class="w-6 h-6 rounded flex items-center justify-center shrink-0 mt-0.5"
                      :style="{
                        background: `${getEventColor(evt.credentialKind)}18`,
                        border: `1px solid ${getEventColor(evt.credentialKind)}30`,
                      }"
                    >
                      <component
                        :is="getEventIcon(evt.credentialKind)"
                        :size="12"
                        :style="{ color: getEventColor(evt.credentialKind) }"
                      />
                    </div>

                    <!-- Title & Detail -->
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <p class="text-[12px] font-medium truncate text-[var(--text-primary)]">
                          {{ evt.title }}
                        </p>
                        <AppBadge
                          v-if="evt.credentialKind"
                          tone="neutral"
                          size="sm"
                          class="text-[9px] px-1.5 py-0"
                        >
                          {{ evt.credentialKind }}
                        </AppBadge>
                      </div>

                      <p v-if="evt.detail" class="text-[11px] truncate text-[var(--text-tertiary)] mt-0.5">
                        {{ evt.detail }}
                      </p>
                    </div>

                    <!-- Timestamp -->
                    <span class="text-[10px] shrink-0 tabular-nums font-mono text-[var(--text-disabled)]">
                      {{ formatTimeAgo(evt.timestamp) }}
                    </span>
                  </div>
                </MotionStaggerItem>
              </MotionStagger>

              <p v-if="isDev" class="text-[9px] mt-3 italic text-[var(--text-disabled)] text-center">
                Development preview — activity is synthetic and held in session memory
              </p>
            </Section>
          </Card>
        </div>

        <!-- Vault Health & Security Status (1 Col) -->
        <div>
          <Card padding="sm">
            <Section title="Vault Health" :icon="ShieldCheck">
              <div class="space-y-3 pt-1">
                <div class="flex items-center justify-between">
                  <span class="text-[12px] text-[var(--text-secondary)]">Session Status</span>
                  <span class="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--success)]">
                    <span class="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse" />
                    Unlocked & Active
                  </span>
                </div>

                <div class="flex items-center justify-between gap-3">
                  <span class="text-[12px] text-[var(--text-secondary)]">Encryption</span>
                  <span class="text-[11px] text-right font-mono text-[var(--text-primary)]">
                    Argon2id · XChaCha20-Poly1305
                  </span>
                </div>

                <div class="flex items-center justify-between">
                  <span class="text-[12px] text-[var(--text-secondary)]">Session Lifetime</span>
                  <span class="text-[11px] tabular-nums font-mono text-[var(--text-primary)]">
                    {{ store.status.lastUnlockedAt ? formatTimeAgo(store.status.lastUnlockedAt) : 'Active' }}
                  </span>
                </div>

                <div class="flex items-center justify-between">
                  <span class="text-[12px] text-[var(--text-secondary)]">Auto-Lock (device)</span>
                  <span class="text-[11px] tabular-nums font-mono text-[var(--text-primary)]">
                    {{ autoLockLabel }}
                  </span>
                </div>
                <p class="text-[10px] italic leading-relaxed text-[var(--text-disabled)]">
                  Auto-lock here is a device-stored preference. The backend enforces its own idle
                  window independently.
                </p>

                <div class="pt-3 border-t border-[var(--border-subtle)] space-y-2">
                  <button
                    type="button"
                    @click="store.navigate('security')"
                    class="w-full flex items-center justify-between p-2 rounded text-[12px] font-medium text-[var(--gold)] bg-[var(--gold-surface)] border border-[var(--gold-border)] hover:opacity-90 transition-opacity"
                  >
                    <span>Run Security Audit</span>
                    <ArrowRight :size="12" />
                  </button>

                  <button
                    type="button"
                    @click="store.navigate('settings')"
                    class="w-full text-center text-[11px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors py-1"
                  >
                    Configure Vault Settings →
                  </button>
                </div>
              </div>
            </Section>
          </Card>
        </div>
      </Grid>
    </MotionReveal>
  </PageContainer>
</template>
