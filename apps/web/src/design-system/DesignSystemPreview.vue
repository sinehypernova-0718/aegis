<script setup lang="ts">
/**
 * DesignSystemPreview — Phase 1 visual foundation showcase.
 *
 * Purpose: let reviewers inspect both themes, tokens, typography, glass
 * tiers, UI primitives and the motion system in isolation BEFORE any
 * application screen is built on top. Sample content here is decorative
 * only (representative strings) — no vault functionality exists or is
 * simulated beyond local demo state (tab selection, modal open, etc.).
 *
 * Mounted from App.vue when the URL hash is #/design-system.
 */
import { ref } from 'vue';
import { motion } from 'motion-v';
import {
	ShieldCheck,
	KeyRound,
	Globe,
	Copy,
	Eye,
	Trash2,
	Settings2,
	MoreHorizontal,
	CheckCircle2,
	AlertTriangle,
	Sparkles,
	Lock,
} from 'lucide-vue-next';
import {
	AppBadge,
	AppButton,
	AppDivider,
	AppIconButton,
	AppInput,
	AppPasswordInput,
	AppSpinner,
	AppTabs,
	AppTooltip,
	Card,
	DropdownShell,
	GlassPanel,
	ModalShell,
	ThemeToggle,
	type TabItem,
} from '@/components/ui';
import { staggers } from '@/motion/tokens';
import DsSection from './DsSection.vue';

/* --- local demo state (presentation only) -------------------------------- */
const demoText = ref('aurora@aegis.dev');
const demoSecret = ref('ag_live_7f3c9a2e41bd80c5');
const activeTab = ref('glass');
const tabs: TabItem[] = [
	{ id: 'glass', label: 'Glass' },
	{ id: 'surfaces', label: 'Surfaces' },
	{ id: 'motion', label: 'Motion' },
];
const modalOpen = ref(false);
const staggerKey = ref(0);

const paletteGroups = [
	{
		name: 'Surfaces & Ink',
		swatches: [
			'--surface-base',
			'--surface-primary',
			'--surface-secondary',
			'--surface-tertiary',
			'--text-primary',
			'--text-secondary',
			'--text-tertiary',
		],
	},
	{
		name: 'Accents',
		swatches: [
			'--accent-primary',
			'--accent-muted',
			'--gold',
			'--gold-muted',
			'--success',
			'--warning',
			'--danger',
		],
	},
] as const;

function replayStagger() {
	staggerKey.value += 1;
}
</script>

<template>
  <div class="relative min-h-full overflow-y-auto" :style="{ background: 'var(--gradient-app)' }">
    <!-- Ambient cinematic backdrop (single instance; GPU-cheap) -->
    <div class="a-aurora" aria-hidden="true">
      <div class="a-aurora__blob a-aurora__blob--1" />
      <div class="a-aurora__blob a-aurora__blob--2" />
      <div class="a-aurora__blob a-aurora__blob--3" />
    </div>

    <div class="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <!-- ================= Header ================= -->
      <header class="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <div class="flex items-center gap-2 mb-2">
            <ShieldCheck :size="20" :style="{ color: 'var(--accent-primary)' }" />
            <span class="a-label">Aegis · Visual Foundation</span>
          </div>
          <h1 class="a-display">Cinematic Glassmorphism</h1>
          <p class="a-supporting mt-2 max-w-xl" :style="{ color: 'var(--text-tertiary)' }">
            Phase 1 design system — tokens, themes, glass tiers, primitives and motion.
            Everything below consumes semantic tokens only. Toggle the theme to inspect both identities.
          </p>
        </div>
        <div class="flex items-center gap-3">
          <AppBadge tone="gold"><Sparkles :size="11" /> Phase 1</AppBadge>
          <ThemeToggle />
        </div>
      </header>

      <AppDivider gold class="mb-8" />

      <!-- ================= Typography ================= -->
      <DsSection title="Typography" description="Sora (display) · Inter (body) · JetBrains Mono (technical). Bundled locally; one register per role.">
        <div class="grid gap-3">
          <p class="a-display">Display — Aegis Vault</p>
          <p class="a-title">Page Title — Credential Overview</p>
          <p class="a-heading">Section Heading — Active Sessions</p>
          <p class="a-subheading">Sub-heading — Recent activity across the vault</p>
          <p class="a-body">Body — All vault data, including names, tags and expiry metadata, is encrypted at rest by the backend.</p>
          <p class="a-supporting">Supporting — Keys rotate automatically every 90 days.</p>
          <div class="flex items-center gap-4 flex-wrap">
            <span class="a-label">Label · Uppercase</span>
            <span class="a-meta">Meta · 10px</span>
            <code class="a-mono">ag_live_7f3c9a2e41bd80c5</code>
          </div>
        </div>
      </DsSection>

      <!-- ================= Palette ================= -->
      <DsSection title="Color System" description="Semantic tokens resolve differently per theme — switch to compare. Never use raw palette values in components.">
        <div v-for="group in paletteGroups" :key="group.name" class="mb-4 last:mb-0">
          <p class="a-label mb-2">{{ group.name }}</p>
          <div class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            <div v-for="token in group.swatches" :key="token" class="rounded-lg border overflow-hidden" :style="{ borderColor: 'var(--border-subtle)' }">
              <div class="h-10" :style="{ background: `var(${token})` }" />
              <p class="a-meta px-1.5 py-1 truncate" :style="{ color: 'var(--text-tertiary)' }">{{ token.replace('--', '') }}</p>
            </div>
          </div>
        </div>
      </DsSection>

      <!-- ================= Glass tiers ================= -->
      <DsSection title="Glass Surfaces" description="Five depth tiers with fixed blur budgets. Gold variant is reserved for premium emphasis — never default chrome.">
        <div class="grid sm:grid-cols-2 gap-3">
          <GlassPanel v-for="depth in (['subtle', 'standard', 'elevated', 'modal'] as const)" :key="depth" :depth="depth" padding="1.25rem" radius="var(--radius-lg)">
            <p class="a-subheading">a-glass--{{ depth }}</p>
            <p class="a-supporting mt-1" :style="{ color: 'var(--text-tertiary)' }">
              Blur and opacity increase with depth so text always sits on a calm field.
            </p>
          </GlassPanel>
          <GlassPanel depth="focused" padding="1.25rem" radius="var(--radius-lg)">
            <p class="a-subheading">a-glass--focused</p>
            <p class="a-supporting mt-1" :style="{ color: 'var(--text-tertiary)' }">Accent ring + glow for the active surface.</p>
          </GlassPanel>
          <GlassPanel depth="standard" gold padding="1.25rem" radius="var(--radius-lg)">
            <p class="a-subheading" :style="{ color: 'var(--gold)' }">a-glass--gold</p>
            <p class="a-supporting mt-1" :style="{ color: 'var(--text-tertiary)' }">Restrained golden border and warm glow.</p>
          </GlassPanel>
        </div>

        <!-- Elevated Cards Showcase -->
        <div class="mt-4">
          <p class="a-label mb-2">Elevated Cards & Tactile Depth</p>
          <div class="grid sm:grid-cols-3 gap-3">
            <Card variant="standard" padding="sm">
              <p class="text-[13px] font-semibold text-[var(--text-primary)]">Standard Glass Card</p>
              <p class="text-[11px] text-[var(--text-tertiary)] mt-1">Specular top rim and layered elevation.</p>
            </Card>
            <Card variant="elevated" padding="sm">
              <p class="text-[13px] font-semibold text-[var(--text-primary)]">Elevated Modal Card</p>
              <p class="text-[11px] text-[var(--text-tertiary)] mt-1">Increased depth, backdrop saturation, and shadow.</p>
            </Card>
            <Card variant="gold" interactive padding="sm">
              <p class="text-[13px] font-semibold text-[var(--gold)]">Gold Interactive Card</p>
              <p class="text-[11px] text-[var(--text-tertiary)] mt-1">Subtle gold tint, hairline border, and hover lift.</p>
            </Card>
          </div>
        </div>

        <div class="mt-4">
          <AppTabs v-model="activeTab" :tabs="tabs" />
          <GlassPanel :depth="activeTab === 'motion' ? 'focused' : 'subtle'" class="mt-3" padding="1rem">
            <p class="a-body">
              <span v-if="activeTab === 'glass'">Tabs drive this panel's depth — a controlled surface transition, not decoration.</span>
              <span v-else-if="activeTab === 'surfaces'">Selection feedback stays on the surface itself: border, glow, tint.</span>
              <span v-else>The indicator pill rides a shared spring preset — layout done with transforms only.</span>
            </p>
          </GlassPanel>
        </div>
      </DsSection>

      <!-- ================= Buttons / inputs ================= -->
      <DsSection title="Controls" description="Buttons, icon buttons, text and masked inputs. Hover lifts and press compression come from centralized presets.">
        <div class="flex flex-wrap items-center gap-2 mb-5">
          <AppButton variant="primary" size="lg">Unlock Vault</AppButton>
          <AppButton variant="secondary">Secondary</AppButton>
          <AppButton variant="glass">Glass</AppButton>
          <AppButton variant="gold"><KeyRound :size="13" /> Generate Key</AppButton>
          <AppButton variant="danger"><Trash2 :size="13" /> Delete</AppButton>
          <AppButton variant="ghost">Ghost</AppButton>
          <AppButton variant="primary" loading>Saving…</AppButton>
          <AppButton variant="secondary" disabled>Disabled</AppButton>
        </div>

        <div class="flex items-center gap-1 mb-5">
          <AppTooltip><template #trigger><AppIconButton :icon="Eye" label="Preview" /></template>Preview</AppTooltip>
          <AppTooltip><template #trigger><AppIconButton :icon="Copy" label="Copy" /></template>Copy identifier</AppTooltip>
          <AppTooltip><template #trigger><AppIconButton :icon="Trash2" label="Delete" tone="danger" /></template>Delete credential</AppTooltip>
          <AppTooltip><template #trigger><AppIconButton :icon="Settings2" label="Settings" /></template>Options</AppTooltip>
          <DropdownShell align="start" width="11rem">
            <template #trigger="{ open: menuOpen, toggle: toggleMenu, menuId: id, setTriggerRef }">
              <!-- Demonstrates the full custom-trigger contract: ARIA state on
                   the real focusable control AND registration via setTriggerRef
                   so DropdownShell can return focus here when the menu closes. -->
              <AppButton
                :ref="setTriggerRef"
                variant="ghost"
                aria-haspopup="menu"
                :aria-expanded="menuOpen ? 'true' : 'false'"
                :aria-controls="menuOpen ? id : undefined"
                @click="toggleMenu"
              ><MoreHorizontal :size="14" /> Menu</AppButton>
            </template>
            <div role="menuitem" tabindex="0" class="px-2.5 py-1.5 rounded-md text-[12px] cursor-pointer hover:bg-[var(--surface-tertiary)]" :style="{ color: 'var(--text-secondary)' }">Reveal secret</div>
            <div role="menuitem" tabindex="0" class="px-2.5 py-1.5 rounded-md text-[12px] cursor-pointer hover:bg-[var(--surface-tertiary)]" :style="{ color: 'var(--text-secondary)' }">Copy identifier</div>
            <AppDivider class="my-1" />
            <div role="menuitem" tabindex="0" class="px-2.5 py-1.5 rounded-md text-[12px] cursor-pointer hover:bg-[var(--danger-muted)]" :style="{ color: 'var(--danger)' }">Delete</div>
          </DropdownShell>
        </div>

        <div class="grid sm:grid-cols-2 gap-4 max-w-xl">
          <AppInput v-model="demoText" label="Account" placeholder="name@example.com" />
          <AppInput label="Disabled" :model-value="'locked input'" disabled />
          <AppPasswordInput v-model="demoSecret" label="Master Passphrase (visual demo only)" />
          <AppInput label="With error" model-value="short" error="Minimum 12 characters." />
        </div>

        <div class="flex flex-wrap items-center gap-2 mt-5">
          <AppBadge>Neutral</AppBadge>
          <AppBadge tone="accent"><Globe :size="11" /> Production</AppBadge>
          <AppBadge tone="gold"><Lock :size="11" /> Premium</AppBadge>
          <AppBadge tone="gold" solid><Lock :size="11" /> Gold Solid</AppBadge>
          <AppBadge tone="accent" solid>Solid Accent</AppBadge>
          <AppBadge tone="success"><CheckCircle2 :size="11" /> Valid</AppBadge>
          <AppBadge tone="warning"><AlertTriangle :size="11" /> Expires soon</AppBadge>
          <AppBadge tone="danger">Revoked</AppBadge>
          <AppBadge size="md" tone="accent">Medium</AppBadge>
        </div>

        <div class="flex items-center gap-4 mt-5">
          <span class="flex items-center gap-2 a-supporting"><AppSpinner :size="16" /> Loading indicators</span>
          <span class="flex items-center gap-2 a-supporting"><AppSpinner :size="12" /> keep functional rotation even under reduced motion</span>
        </div>
      </DsSection>

      <!-- ================= Motion ================= -->
      <DsSection title="Motion System" description="Durations, easings and springs live in src/motion/tokens.ts; interaction bundles in presets.ts. Reduced-motion collapses all of this instantly.">
        <div class="flex items-center gap-3 mb-4">
          <AppButton variant="secondary" @click="replayStagger">Replay staggered entrance</AppButton>
          <AppButton variant="primary" @click="modalOpen = true">Present modal</AppButton>
        </div>

        <!-- Staggered list demo -->
        <div :key="staggerKey" class="grid sm:grid-cols-3 gap-3">
          <motion.div
            v-for="(row, i) in [
              { t: 'Vault unlocked', d: 'cinematic 800ms · ease-out' },
              { t: 'Credential revealed', d: 'component 300ms · layered' },
              { t: 'Row deleted', d: 'exit faster than enter' },
            ]"
            :key="row.t"
            :initial="{ opacity: 0, y: 14, scale: 0.98 }"
            :animate="{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: i * staggers.section } }"
          >
            <GlassPanel depth="subtle" padding="0.9rem" radius="var(--radius-md)">
              <p class="a-subheading">{{ row.t }}</p>
              <p class="a-meta mt-0.5" :style="{ color: 'var(--text-tertiary)' }">{{ row.d }}</p>
            </GlassPanel>
          </motion.div>
        </div>

        <div class="grid sm:grid-cols-3 gap-3 mt-4">
          <GlassPanel depth="standard" padding="0.9rem">
            <p class="a-label mb-2">Hover</p>
            <motion.div
              :while-hover="{ y: -2 }"
              :while-tap="{ scale: 0.985 }"
              class="rounded-md px-3 py-2 text-[12px]"
              :style="{ background: 'var(--accent-muted)', color: 'var(--accent-primary)', border: '1px solid var(--accent-border)' }"
            >Card lift · quiet</motion.div>
          </GlassPanel>
          <GlassPanel depth="standard" padding="0.9rem">
            <p class="a-label mb-2">Focus</p>
            <input class="w-full rounded-md px-3 py-2 text-[12px] outline-none" :style="{ background: 'var(--surface-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }" placeholder="Tab to me — token focus ring" />
          </GlassPanel>
          <GlassPanel depth="standard" padding="0.9rem">
            <p class="a-label mb-2">Theme crossfade</p>
            <p class="a-supporting" :style="{ color: 'var(--text-tertiary)' }">Use the header toggle — View Transition snapshot crossfade, CSS-interpolation fallback elsewhere.</p>
          </GlassPanel>
        </div>
      </DsSection>

      <!-- ================= Footer ================= -->
      <footer class="mt-2 mb-8">
        <AppDivider class="mb-4" />
        <p class="a-meta" :style="{ color: 'var(--text-disabled)' }">
          Aegis design system · Phase 1 · No application logic demonstrated — sample strings are decorative.
        </p>
      </footer>
    </div>

    <!-- ================= Modal shell demo ================= -->
    <ModalShell :open="modalOpen" labelled-by="ds-modal-title" @close="modalOpen = false">
      <h3 id="ds-modal-title" class="a-heading mb-2">Modal Presentation</h3>
      <p class="a-body mb-5">
        Modal-tier glass over a light-blur scrim, spring entrance, fast exit, focus trap and Escape handling —
        presentation only, ready for real workflows in later phases.
      </p>
      <div class="flex justify-end gap-2">
        <AppButton variant="ghost" @click="modalOpen = false">Cancel</AppButton>
        <AppButton variant="primary" @click="modalOpen = false">Understood</AppButton>
      </div>
    </ModalShell>
  </div>
</template>
