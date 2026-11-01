<script setup lang="ts">
/**
 * SettingsView — application preferences.
 *
 * Sections:
 *  - Appearance: theme selection with animated ThemeToggle, font and display
 *    preferences (theme is stored locally in the browser).
 *  - General: auto-lock timeout selector and clipboard-hygiene preference,
 *    stored on this device (localStorage) via the shared composable. The
 *    banner and per-item notes state precisely what is real today: the
 *    backend enforces idle auto-lock on its own configured window; these
 *    device-stored preferences are not wired to that authority yet, and no
 *    backend clipboard operation exists.
 *  - About: build identity and environment information (local backend).
 *
 * Motion: section cards enter with one-time viewport reveals; the theme
 * toggle uses the shared ThemeToggle component so the Sidebar and Settings
 * share one animated knob aesthetic.
 */
import { computed, onBeforeUnmount, ref } from 'vue';
import { Sun, SlidersHorizontal, Info, Clock, CheckCircle2 } from 'lucide-vue-next';
import { useTheme } from '@/composables/useTheme';
import {
	AUTO_LOCK_OPTIONS,
	useSessionPreferences,
	type AutoLockValue,
} from '@/composables/useSessionPreferences';
import PageContainer from '@/components/layout/PageContainer.vue';
import PageHeader from '@/components/layout/PageHeader.vue';
import Card from '@/components/ui/Card.vue';
import AppButton from '@/components/ui/AppButton.vue';
import Section from '@/components/layout/Section.vue';
import KeyValue from '@/components/ui/KeyValue.vue';
import ThemeToggle from '@/components/ui/ThemeToggle.vue';
import AppSelect, { type AppSelectOption } from '@/components/ui/AppSelect.vue';
import { MotionReveal } from '@/motion/components';

const { theme } = useTheme();

/**
 * Shared session-preference state (src/composables/useSessionPreferences.ts):
 * the same singleton refs SecurityView displays. Changing values here keeps
 * both views consistent.
 */
const { autoLockTimeout, clearClipboardOnLock } = useSessionPreferences();

// AppSelect is string-modeled; bridge the numeric auto-lock values safely.
const AUTO_LOCK_SELECT_OPTIONS: AppSelectOption[] = AUTO_LOCK_OPTIONS.map((o) => ({
	value: String(o.value),
	label: o.label,
}));
const autoLockSelectValue = computed<string>({
	get: () => String(autoLockTimeout.value),
	set: (value) => {
		const match = AUTO_LOCK_OPTIONS.find((o) => String(o.value) === value);
		if (match) autoLockTimeout.value = match.value;
	},
});

const showSavedBanner = ref(false);
let savedBannerTimer: ReturnType<typeof setTimeout> | null = null;

function savePreferences() {
	// Persistence is immediate (debounced, localStorage) via the shared
	// composable; this button exists for explicit user confirmation feedback.
	showSavedBanner.value = true;
	if (savedBannerTimer) clearTimeout(savedBannerTimer);
	savedBannerTimer = setTimeout(() => {
		showSavedBanner.value = false;
	}, 2500);
}

// Clean up the pending banner timer so it never fires after unmount
// (avoids writing to dead reactive state and stray timers in tests).
onBeforeUnmount(() => {
	if (savedBannerTimer) {
		clearTimeout(savedBannerTimer);
		savedBannerTimer = null;
	}
});

function resetPreferences() {
	autoLockTimeout.value = 15;
	clearClipboardOnLock.value = true;
}
</script>

<template>
  <PageContainer>
    <template #sticky-title>
      <span class="text-[11px] font-medium tracking-[0.08em] uppercase text-[var(--text-tertiary)]">
        Settings
      </span>
    </template>

    <!-- Header -->
    <MotionReveal tag="header" :distance="12" :once="true">
      <PageHeader
        title="Settings"
        description="Application preferences and display options"
      />
    </MotionReveal>

    <!-- Appearance -->
    <MotionReveal :once="true" :amount="0.2">
      <Card padding="md">
        <Section title="Appearance" :icon="Sun">
          <div class="space-y-4">
            <!-- Theme toggle -->
            <div class="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p class="text-[13px] font-medium text-[var(--text-primary)]">Theme</p>
                <p class="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                  Switch between Glacier (light) and Midnight (dark)
                </p>
              </div>
              <div class="flex items-center gap-3 shrink-0">
                <span class="text-[11px] text-[var(--text-tertiary)]">
                  {{ theme === 'dark' ? 'Midnight' : 'Glacier' }}
                </span>
                <ThemeToggle size="md" />
              </div>
            </div>

            <!-- Theme description -->
            <div
              class="rounded-md p-3 border text-[11px] leading-relaxed text-[var(--text-tertiary)]"
              :style="{ background: 'var(--surface-secondary)', borderColor: 'var(--border-subtle)' }"
            >
              <span class="font-medium text-[var(--text-secondary)]">
                {{ theme === 'dark' ? 'Midnight' : 'Glacier' }}
              </span>
              —
              {{ theme === 'dark'
                ? 'Graphite and charcoal foundations with layered dark surfaces, restrained navy-blue depth, and subtle gold accents.'
                : 'Clean white and off-white surfaces with soft ice-blue primary accents, muted warm gold highlights, and blue-grey borders.'
              }}
              Theme preference is stored locally in your browser.
            </div>
          </div>
        </Section>
      </Card>
    </MotionReveal>

    <!-- General preferences -->
    <MotionReveal :once="true" :amount="0.2">
      <Card padding="md">
        <Section title="Session Preferences" :icon="SlidersHorizontal">
          <!-- Honest scope note: device-stored but not wired to the backend's session authority -->
          <div
            class="flex items-start gap-2 p-2.5 rounded-md border mb-3"
            :style="{ background: 'var(--warning-muted)', borderColor: 'var(--warning)' + '40' }"
          >
            <Clock :size="12" class="mt-0.5 shrink-0" :style="{ color: 'var(--warning)' }" />
            <p class="text-[11px] leading-relaxed" :style="{ color: 'var(--text-secondary)' }">
              <span class="font-semibold" :style="{ color: 'var(--warning)' }">Scope:</span>
              these preferences are stored on this device (localStorage) and survive reloads.
              The backend enforces idle auto-lock on its own configured window
              (5 minutes by default, <span class="font-mono">AEGIS_IDLE_TIMEOUT_MS</span>);
              wiring this selector to that authority is not
              implemented yet.
            </p>
          </div>

          <div class="space-y-4">
            <!-- Auto-lock timeout -->
            <div class="flex items-center justify-between gap-4 flex-wrap">
              <div class="flex-1 min-w-0">
                <p class="text-[13px] font-medium text-[var(--text-primary)]">Auto-lock timeout</p>
                <p class="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                  How long the vault stays unlocked without interaction
                </p>
              </div>
              <AppSelect
                v-model="autoLockSelectValue"
                class="w-40 shrink-0"
                :options="AUTO_LOCK_SELECT_OPTIONS"
                size="md"
                ariaLabel="Auto-lock timeout"
              />
            </div>

            <!-- Clear clipboard on lock — NO EFFECT YET:
                 toggling performs no clipboard operation. -->
            <div class="flex items-start justify-between gap-4 flex-wrap">
              <div class="flex-1 min-w-[240px]">
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="text-[13px] font-medium text-[var(--text-primary)]">Clear clipboard on lock</p>
                  <span
                    class="text-[9px] font-mono px-1.5 py-0.5 rounded"
                    :style="{ color: 'var(--warning)', background: 'var(--warning-muted)' }"
                  >
                    NOT ACTIVE
                  </span>
                </div>
                <p class="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                  Intended behaviour: remove copied secrets from the clipboard when the vault locks.
                </p>
                <p id="clipboard-preference-note" class="text-[10px] mt-1 leading-relaxed" :style="{ color: 'var(--warning)' }">
                  Enabling this preference does not currently clear the operating-system clipboard —
                  the backend lock flow has no clipboard step yet, so this toggle changes nothing
                  until that wiring ships.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                :aria-checked="clearClipboardOnLock"
                :aria-label="clearClipboardOnLock ? 'Disable clear clipboard on lock preference' : 'Enable clear clipboard on lock preference'"
                aria-describedby="clipboard-preference-note"
                class="relative mt-1 w-11 h-6 rounded-full border outline-none transition-colors shrink-0"
                :style="{
                  background: clearClipboardOnLock ? 'var(--accent-primary)' : 'var(--surface-tertiary)',
                  borderColor: clearClipboardOnLock ? 'var(--accent-border)' : 'var(--border-default)',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.15)',
                }"
                @click="clearClipboardOnLock = !clearClipboardOnLock"
              >
                <span
                  class="absolute top-0.5 rounded-full bg-white transition-all duration-200"
                  :style="{
                    width: '18px',
                    height: '18px',
                    left: clearClipboardOnLock ? 'calc(100% - 20px)' : '2px',
                    boxShadow: 'var(--shadow-sm)',
                  }"
                />
              </button>
            </div>
          </div>

          <!-- Save / Reset actions -->
          <div class="flex items-center justify-between gap-3 pt-3 border-t" :style="{ borderColor: 'var(--border-subtle)' }">
            <!-- Save confirmation feedback -->
            <div
              class="flex items-center gap-1.5 text-[11px] transition-all duration-300"
              :style="{
                color: 'var(--success)',
                opacity: showSavedBanner ? 1 : 0,
                transform: showSavedBanner ? 'translateX(0)' : 'translateX(-6px)',
              }"
              aria-live="polite"
              aria-atomic="true"
            >
              <CheckCircle2 :size="13" />
              Preferences saved on this device
            </div>

            <div class="flex items-center gap-2 ml-auto">
              <AppButton variant="ghost" size="sm" @click="resetPreferences">
                Reset
              </AppButton>
              <AppButton variant="secondary" size="sm" @click="savePreferences">
                Save
              </AppButton>
            </div>
          </div>
        </Section>
      </Card>
    </MotionReveal>

    <!-- About -->
    <MotionReveal :once="true" :amount="0.2">
      <Card padding="md">
        <Section title="About" :icon="Info">
          <div class="space-y-2.5">
            <KeyValue label="Application">
              <span class="text-[11px] font-medium text-[var(--text-primary)]">Aegis Vault</span>
            </KeyValue>
            <KeyValue label="Framework">
              <span class="text-[11px] text-[var(--text-primary)]">Vue 3 + TypeScript</span>
            </KeyValue>
            <KeyValue label="State">
              <span class="text-[11px] text-[var(--text-primary)]">Pinia</span>
            </KeyValue>
            <KeyValue label="Motion">
              <span class="text-[11px] text-[var(--text-primary)]">motion-v</span>
            </KeyValue>
            <KeyValue label="Backend">
              <span class="text-[11px] text-[var(--text-primary)]">Local Aegis backend (Fastify)</span>
            </KeyValue>
            <KeyValue label="Backend address">
              <span class="text-[10px] font-mono text-[var(--text-tertiary)]">http://127.0.0.1:7787 (loopback only)</span>
            </KeyValue>
            <KeyValue label="Recovery">
              <span class="text-[11px] text-[var(--text-primary)]">Backend-issued recovery key + recovery unlock</span>
            </KeyValue>
          </div>
        </Section>
      </Card>
    </MotionReveal>
  </PageContainer>
</template>
