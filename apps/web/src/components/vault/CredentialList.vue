<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from 'vue';
import { Motion, AnimatePresence } from 'motion-v';
import {
	Search,
	Plus,
	Filter,
	ArrowUpDown,
	Eye,
	EyeOff,
	Copy,
	Check,
	ExternalLink,
	Edit3,
	Trash2,
	X,
	Tag,
	Key,
	Terminal,
	Shield,
	FileText,
	Globe,
	Fingerprint,
	Lock,
} from 'lucide-vue-next';
import { useVaultStore } from '@/stores/vaultStore';
import { CATEGORIES, CREDENTIAL_KINDS } from '@/services/api/contracts';
import type {
	CredentialSummary,
	CredentialKind,
	CreateCredentialInput,
	UpdateCredentialInput,
	ApiKeyDetail,
	OAuth2Detail,
	SshKeyDetail,
	SecureNoteDetail,
} from '@/types';
import AppButton from '@/components/ui/AppButton.vue';
import AppBadge from '@/components/ui/AppBadge.vue';
import AppDialog from '@/components/ui/AppDialog.vue';
import ModalShell from '@/components/ui/ModalShell.vue';
import CredentialForm from '@/components/vault/CredentialForm.vue';
import SplitLayout from '@/components/layout/SplitLayout.vue';
import SplitSidebarHeader from '@/components/layout/SplitSidebarHeader.vue';
import DetailContainer from '@/components/layout/DetailContainer.vue';
import DetailHeader from '@/components/layout/DetailHeader.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import FieldGroup from '@/components/ui/FieldGroup.vue';
import KeyValue from '@/components/ui/KeyValue.vue';
import AppSelect, { type AppSelectOption } from '@/components/ui/AppSelect.vue';

interface Props {
	title: string;
	subtitle: string;
	items?: CredentialSummary[];
	defaultKind?: CredentialKind;
	allowedKinds?: CredentialKind[];
}

const props = defineProps<Props>();

const store = useVaultStore();

const searchQuery = ref('');
const selectedCategory = ref('All');
// String-backed (the AppSelect model is generic); item.kind comparisons only.
const selectedKindFilter = ref<string>(props.defaultKind ?? 'all');
const sortOrder = ref<'asc' | 'desc'>('desc');
const sortBy = ref<'title' | 'updatedAt'>('updatedAt');
const showFilters = ref(false);

// Filter select option sets (AppSelect).
const CATEGORY_FILTER_OPTIONS = [...CATEGORIES];
const KIND_FILTER_OPTIONS: AppSelectOption[] = [
	{ value: 'all', label: 'All Types' },
	...CREDENTIAL_KINDS,
];

const showCreateModal = ref(false);
const showEditModal = ref(false);
const showDeleteConfirm = ref(false);
const isDeleting = ref(false);

const revealedId = ref<string | null>(null);
const copiedId = ref<string | null>(null);
const copiedPublicKey = ref(false);
let autoConcealTimer: ReturnType<typeof setTimeout> | null = null;

const sourceItems = computed(() => {
	if (props.items) {
		return props.items;
	}
	if (props.allowedKinds && props.allowedKinds.length > 0) {
		return store.credentials.filter((c) => props.allowedKinds!.includes(c.kind));
	}
	return store.credentials;
});

const filteredItems = computed(() => {
	return sourceItems.value
		.filter((item) => {
			// Kind filtering
			if (selectedKindFilter.value !== 'all' && item.kind !== selectedKindFilter.value) {
				return false;
			}
			// Category filtering
			if (selectedCategory.value !== 'All' && item.category !== selectedCategory.value) {
				return false;
			}
			// Search query
			if (searchQuery.value.trim()) {
				const q = searchQuery.value.trim().toLowerCase();
				const matchesTitle = item.title.toLowerCase().includes(q);
				const matchesUser = item.username?.toLowerCase().includes(q);
				const matchesCat = item.category?.toLowerCase().includes(q);
				const matchesTags = item.tags.some((t) => t.toLowerCase().includes(q));
				const matchesKind = item.kind.toLowerCase().includes(q);
				return matchesTitle || matchesUser || matchesCat || matchesTags || matchesKind;
			}
			return true;
		})
		.sort((a, b) => {
			const key = sortBy.value;
			const aVal = String(a[key] ?? '');
			const bVal = String(b[key] ?? '');
			const cmp = aVal.localeCompare(bVal);
			return sortOrder.value === 'asc' ? cmp : -cmp;
		});
});

// Kind icon helper
function getKindIcon(k: CredentialKind) {
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
	}
}

// Kind badge tone helper
function getKindBadgeTone(
	k: CredentialKind,
): 'neutral' | 'accent' | 'gold' | 'success' | 'warning' | 'danger' {
	switch (k) {
		case 'password':
			return 'accent';
		case 'api-key':
			return 'neutral';
		case 'access-token':
			return 'gold';
		case 'ssh-key':
			return 'success';
		case 'oauth2':
			return 'gold';
		case 'secure-note':
			return 'warning';
	}
}

// Environment badge tone helper
function getEnvTone(
	env?: string,
): 'neutral' | 'accent' | 'gold' | 'success' | 'warning' | 'danger' {
	switch (env) {
		case 'production':
			return 'danger';
		case 'staging':
			return 'warning';
		case 'development':
			return 'success';
		default:
			return 'neutral';
	}
}

function getSecretLabel(k?: CredentialKind): string {
	switch (k) {
		case 'password':
			return 'Password';
		case 'api-key':
			return 'API Key Secret';
		case 'access-token':
			return 'Access Token Secret';
		case 'ssh-key':
			return 'Private Key';
		case 'oauth2':
			return 'Client Secret';
		case 'secure-note':
			return 'Secure Note Content';
		default:
			return 'Secret Value';
	}
}

function toggleReveal(id: string) {
	if (revealedId.value === id) {
		revealedId.value = null;
		if (autoConcealTimer) clearTimeout(autoConcealTimer);
	} else {
		revealedId.value = id;
		if (autoConcealTimer) clearTimeout(autoConcealTimer);
		// Security timeout: automatically re-conceal secret after 30 seconds
		autoConcealTimer = setTimeout(() => {
			if (revealedId.value === id) {
				revealedId.value = null;
			}
		}, 30000);
	}
}

async function copySecret(id: string, secret: string) {
	if (revealedId.value !== id) {
		// Reveal momentarily or allow copy with feedback
		toggleReveal(id);
	}
	try {
		await navigator.clipboard.writeText(secret);
		copiedId.value = id;
		setTimeout(() => {
			copiedId.value = null;
		}, 2000);
	} catch {
		/* clipboard access failed */
	}
}

async function copyPublicKey(pubKey: string) {
	try {
		await navigator.clipboard.writeText(pubKey);
		copiedPublicKey.value = true;
		setTimeout(() => {
			copiedPublicKey.value = false;
		}, 2000);
	} catch {
		/* clipboard access failed */
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

// Reset reveal state whenever selection changes
watch(
	() => store.selectedCredential?.id,
	() => {
		revealedId.value = null;
		copiedId.value = null;
		copiedPublicKey.value = false;
		if (autoConcealTimer) clearTimeout(autoConcealTimer);
	},
);

onUnmounted(() => {
	if (autoConcealTimer) clearTimeout(autoConcealTimer);
});

async function handleCreate(data: CreateCredentialInput) {
	try {
		const summary = await store.createCredential(data);
		showCreateModal.value = false;
		// Automatically select the newly created credential for immediate inspection
		await store.selectCredential(summary.id);
	} catch {
		/* error notification handled in store */
	}
}

async function handleUpdate(data: UpdateCredentialInput) {
	if (!store.selectedCredential) return;
	try {
		await store.updateCredential(store.selectedCredential.id, data);
		showEditModal.value = false;
		// Refresh selection
		await store.selectCredential(store.selectedCredential.id);
	} catch {
		/* error notification handled in store */
	}
}

async function handleDelete() {
	if (!store.selectedCredential) return;
	isDeleting.value = true;
	try {
		await store.deleteCredential(store.selectedCredential.id);
		showDeleteConfirm.value = false;
	} catch {
		/* error notification handled in store */
	} finally {
		isDeleting.value = false;
	}
}
</script>

<template>
  <SplitLayout>
    <!-- Left Sidebar: Credential List -->
    <template #sidebar>
      <SplitSidebarHeader :title="title" :subtitle="subtitle">
        <template #actions>
          <AppButton variant="gold" size="sm" @click="showCreateModal = true">
            <Plus :size="13" />
            New
          </AppButton>
        </template>
      </SplitSidebarHeader>

      <!-- Search & Filters Toolbar -->
      <div class="px-4 py-3 border-b space-y-2.5 border-[var(--border-subtle)] bg-[var(--surface-primary)]">
        <!-- Search bar -->
        <div class="relative">
          <Search
            :size="13"
            class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-tertiary)]"
          />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search vault items..."
            class="w-full pl-9 pr-3 py-1.5 text-[12px] rounded-md border outline-none transition-all"
            :style="{
              background: 'var(--surface-input)',
              borderColor: 'var(--border-default)',
              color: 'var(--text-primary)',
              boxShadow: 'var(--specular-rim-subtle)',
            }"
            @focus="($event.target as HTMLInputElement).style.borderColor = 'var(--border-focus)'"
            @blur="($event.target as HTMLInputElement).style.borderColor = 'var(--border-default)'"
          />
        </div>

        <!-- Filter Controls -->
        <div class="flex items-center gap-1.5">
          <button
            type="button"
            @click="showFilters = !showFilters"
            class="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all"
            :style="{
              color: showFilters ? 'var(--gold)' : 'var(--text-tertiary)',
              background: showFilters ? 'var(--gold-surface)' : 'var(--surface-secondary)',
              borderColor: showFilters ? 'var(--gold-border)' : 'var(--border-subtle)',
            }"
          >
            <Filter :size="11" />
            Filters
          </button>

          <button
            type="button"
            @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'"
            class="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all text-[var(--text-tertiary)] bg-[var(--surface-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
          >
            <ArrowUpDown :size="11" />
            {{ sortBy === 'title' ? 'Title' : 'Updated' }}
            <span class="text-[9px] uppercase tracking-wider text-[var(--text-disabled)] ml-0.5">
              {{ sortOrder }}
            </span>
          </button>

          <span class="text-[11px] ml-auto tabular-nums font-mono text-[var(--text-disabled)]">
            {{ filteredItems.length }}
          </span>
        </div>

        <!-- Expanded Filter Dropdowns -->
        <AnimatePresence>
          <Motion
            v-if="showFilters"
            :initial="{ height: 0, opacity: 0 }"
            :animate="{ height: 'auto', opacity: 1 }"
            :exit="{ height: 0, opacity: 0 }"
            :transition="{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }"
            class="overflow-hidden space-y-2 pt-1"
          >
            <!-- Category dropdown -->
            <div class="flex items-center gap-2">
              <label class="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] w-16 shrink-0">
                Category
              </label>
              <AppSelect
                v-model="selectedCategory"
                class="flex-1"
                :options="CATEGORY_FILTER_OPTIONS"
                size="sm"
                ariaLabel="Filter by category"
              />
            </div>

            <!-- Kind dropdown -->
            <div class="flex items-center gap-2">
              <label class="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] w-16 shrink-0">
                Type
              </label>
              <AppSelect
                v-model="selectedKindFilter"
                class="flex-1"
                :options="KIND_FILTER_OPTIONS"
                size="sm"
                ariaLabel="Filter by type"
              />
            </div>
          </Motion>
        </AnimatePresence>
      </div>

      <!-- Item List Container -->
      <div class="flex-1 overflow-y-auto p-2 space-y-1">
        <EmptyState
          v-if="filteredItems.length === 0"
          :icon="Tag"
          title="No credentials found"
          :description="sourceItems.length === 0 ? 'Create your first credential above' : 'Try adjusting search or filters'"
        />

        <Motion
          v-for="(item, i) in filteredItems"
          v-else
          :key="item.id"
          :initial="{ opacity: 0, x: -6 }"
          :animate="{ opacity: 1, x: 0 }"
          :transition="{ duration: 0.18, delay: Math.min(i * 0.015, 0.15), ease: [0.16, 1, 0.3, 1] }"
        >
          <button
            type="button"
            @click="store.selectCredential(item.id)"
            class="w-full text-left p-3 rounded-lg border transition-all relative group"
            :style="{
              background:
                store.selectedCredential?.id === item.id
                  ? 'var(--surface-elevated)'
                  : 'var(--surface-primary)',
              borderColor:
                store.selectedCredential?.id === item.id
                  ? 'var(--gold-border)'
                  : 'var(--border-subtle)',
              boxShadow:
                store.selectedCredential?.id === item.id
                  ? 'var(--shadow-gold), var(--specular-rim-gold)'
                  : 'var(--specular-rim-subtle)',
            }"
          >
            <div class="flex items-start justify-between gap-2">
              <p class="text-[13px] font-medium truncate text-[var(--text-primary)] flex-1">
                {{ item.title }}
              </p>
              <AppBadge :tone="getKindBadgeTone(item.kind)" size="sm">
                <component :is="getKindIcon(item.kind)" :size="10" />
                <span>{{ item.kind }}</span>
              </AppBadge>
            </div>

            <div class="flex items-center justify-between gap-2 mt-1">
              <p class="text-[11px] truncate text-[var(--text-tertiary)] flex-1">
                {{ item.username || item.category || 'Uncategorized' }}
              </p>
              <span class="text-[10px] tabular-nums shrink-0 text-[var(--text-disabled)] font-mono">
                {{ formatTimeAgo(item.updatedAt) }}
              </span>
            </div>
          </button>
        </Motion>
      </div>
    </template>

    <!-- Right Pane: Credential Detail View -->
    <template #detail>
      <!-- Empty placeholder when no credential is selected -->
      <div v-if="!store.selectedCredential" class="flex flex-col items-center justify-center h-full text-center px-4">
        <div class="w-12 h-12 rounded-full flex items-center justify-center mb-3 bg-[var(--surface-secondary)] border border-[var(--border-subtle)] text-[var(--text-tertiary)]">
          <Lock :size="20" />
        </div>
        <p class="text-[14px] font-medium text-[var(--text-secondary)]">
          No credential selected
        </p>
        <p class="text-[12px] text-[var(--text-tertiary)] max-w-xs mt-1">
          Choose an item from the sidebar to view details, reveal secrets, or edit configuration.
        </p>
      </div>

      <!-- Credential Detail Content -->
      <Motion
        v-else
        :key="store.selectedCredential.id"
        :initial="{ opacity: 0, y: 6 }"
        :animate="{ opacity: 1, y: 0 }"
        :transition="{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }"
        class="h-full overflow-y-auto"
      >
        <DetailContainer maxWidth="720px">
          <!-- Detail Header -->
          <DetailHeader
            :title="store.selectedCredential.title"
            :subtitle="store.selectedCredential.category || 'Uncategorized'"
          >
            <template #actions>
              <AppBadge :tone="getKindBadgeTone(store.selectedCredential.kind)" size="md" solid>
                <component :is="getKindIcon(store.selectedCredential.kind)" :size="12" />
                <span>{{ store.selectedCredential.kind }}</span>
              </AppBadge>

              <button
                type="button"
                @click="showEditModal = true"
                title="Edit Credential"
                class="p-2 rounded-md border transition-all text-[var(--text-secondary)] bg-[var(--surface-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
              >
                <Edit3 :size="14" />
              </button>

              <button
                type="button"
                @click="showDeleteConfirm = true"
                title="Delete Credential"
                class="p-2 rounded-md border transition-all text-[var(--danger)] bg-[var(--surface-secondary)] border-[var(--border-subtle)] hover:bg-[var(--danger-muted)] hover:border-[var(--danger)]"
              >
                <Trash2 :size="14" />
              </button>

              <button
                type="button"
                @click="store.selectCredential(null)"
                title="Close"
                class="p-2 rounded-md border transition-all text-[var(--text-tertiary)] bg-[var(--surface-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
              >
                <X :size="14" />
              </button>
            </template>
          </DetailHeader>

          <!-- Main Fields & Metadata Content -->
          <div class="space-y-5">
            <!-- 1. Secret Visibility & Copy Interaction -->
            <FieldGroup :label="getSecretLabel(store.selectedCredential.kind)">
              <div
                class="rounded-lg border transition-all p-3"
                :style="{
                  background: 'var(--surface-primary)',
                  borderColor:
                    revealedId === store.selectedCredential.id
                      ? 'var(--gold-border)'
                      : 'var(--border-default)',
                  boxShadow:
                    revealedId === store.selectedCredential.id
                      ? 'var(--shadow-gold), var(--specular-rim-gold)'
                      : 'var(--specular-rim-subtle)',
                }"
              >
                <div class="flex items-start gap-2.5">
                  <!-- Monospace Secret Display Area -->
                  <div class="flex-1 font-mono text-[13px] break-all select-all min-h-[2.5rem] flex items-center">
                    <AnimatePresence mode="wait">
                      <!-- Revealed state -->
                      <Motion
                        v-if="revealedId === store.selectedCredential.id"
                        key="revealed"
                        :initial="{ opacity: 0, filter: 'blur(4px)' }"
                        :animate="{ opacity: 1, filter: 'blur(0px)' }"
                        :exit="{ opacity: 0, filter: 'blur(4px)' }"
                        :transition="{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }"
                        class="w-full text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap"
                      >
                        {{ store.selectedCredential.secret }}
                      </Motion>

                      <!-- Masked state (security: actual secret text is NEVER in DOM here) -->
                      <Motion
                        v-else
                        key="masked"
                        :initial="{ opacity: 0 }"
                        :animate="{ opacity: 1 }"
                        :exit="{ opacity: 0 }"
                        :transition="{ duration: 0.15 }"
                        class="w-full tracking-widest text-[var(--text-disabled)] select-none text-[14px]"
                      >
                        ••••••••••••••••••••••••
                      </Motion>
                    </AnimatePresence>
                  </div>

                  <!-- Secret Controls: Eye & Copy -->
                  <div class="flex items-center gap-1.5 shrink-0 self-center">
                    <button
                      type="button"
                      @click="toggleReveal(store.selectedCredential!.id)"
                      :title="revealedId === store.selectedCredential.id ? 'Hide Secret' : 'Reveal Secret'"
                      class="p-2 rounded-md border transition-all bg-[var(--surface-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-tertiary)] hover:text-[var(--text-primary)]"
                    >
                      <EyeOff v-if="revealedId === store.selectedCredential.id" :size="14" />
                      <Eye v-else :size="14" />
                    </button>

                    <button
                      type="button"
                      @click="copySecret(store.selectedCredential!.id, store.selectedCredential!.secret)"
                      title="Copy Secret to Clipboard"
                      class="p-2 rounded-md border transition-all"
                      :style="{
                        background:
                          copiedId === store.selectedCredential.id
                            ? 'var(--success-muted)'
                            : 'var(--surface-secondary)',
                        borderColor:
                          copiedId === store.selectedCredential.id
                            ? 'var(--success)'
                            : 'var(--border-subtle)',
                        color:
                          copiedId === store.selectedCredential.id
                            ? 'var(--success)'
                            : 'var(--text-secondary)',
                      }"
                    >
                      <Check v-if="copiedId === store.selectedCredential.id" :size="14" />
                      <Copy v-else :size="14" />
                    </button>
                  </div>
                </div>

                <!-- Subtle auto-conceal notice when revealed -->
                <p
                  v-if="revealedId === store.selectedCredential.id"
                  class="text-[10px] mt-2 text-[var(--text-tertiary)] flex items-center gap-1"
                >
                  <Lock :size="10" />
                  Auto-conceals in 30 seconds for security
                </p>
              </div>
            </FieldGroup>

            <!-- 2. Username / Identifier / ARN -->
            <FieldGroup
              v-if="store.selectedCredential.username"
              :label="
                store.selectedCredential.kind === 'password'
                  ? 'Username / Email'
                  : store.selectedCredential.kind === 'ssh-key'
                  ? 'User @ Host'
                  : store.selectedCredential.kind === 'access-token'
                  ? 'Token Identifier / Role'
                  : 'Identifier'
              "
            >
              <div class="px-3 py-2 text-[13px] font-mono rounded-md border bg-[var(--surface-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]">
                {{ store.selectedCredential.username }}
              </div>
            </FieldGroup>

            <!-- 3. URL Link -->
            <FieldGroup v-if="store.selectedCredential.url" label="Service / Login URL">
              <div class="flex items-center gap-2 px-3 py-2 text-[13px] rounded-md border bg-[var(--surface-primary)] border-[var(--border-subtle)]">
                <ExternalLink :size="13" class="text-[var(--text-tertiary)] shrink-0" />
                <a
                  :href="store.selectedCredential.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="truncate transition-colors text-[var(--accent-primary)] hover:text-[var(--accent-hover)] font-medium"
                >
                  {{ store.selectedCredential.url }}
                </a>
              </div>
            </FieldGroup>

            <!-- 4. Specialized Metadata Blocks based on Kind -->
            <!-- A. API Key & Access Token Metadata -->
            <div
              v-if="
                (store.selectedCredential.kind === 'api-key' || store.selectedCredential.kind === 'access-token') &&
                (store.selectedCredential.apiKeyMetadata || store.selectedCredential.metadata)
              "
              class="rounded-lg border p-4 space-y-3 bg-[var(--surface-primary)] border-[var(--border-subtle)]"
            >
              <h3 class="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                API Configuration & Telemetry
              </h3>
              <div class="grid grid-cols-2 gap-3">
                <KeyValue
                  v-if="(store.selectedCredential.apiKeyMetadata || store.selectedCredential.metadata)?.provider"
                  label="Provider"
                >
                  <span class="text-[12px] font-medium text-[var(--text-primary)]">
                    {{ (store.selectedCredential.apiKeyMetadata || store.selectedCredential.metadata)?.provider }}
                  </span>
                </KeyValue>

                <KeyValue
                  v-if="(store.selectedCredential.apiKeyMetadata || store.selectedCredential.metadata)?.environment"
                  label="Environment"
                >
                  <AppBadge
                    :tone="getEnvTone((store.selectedCredential.apiKeyMetadata || store.selectedCredential.metadata)?.environment)"
                    size="sm"
                    solid
                  >
                    {{ (store.selectedCredential.apiKeyMetadata || store.selectedCredential.metadata)?.environment }}
                  </AppBadge>
                </KeyValue>

                <KeyValue
                  v-if="(store.selectedCredential.apiKeyMetadata || store.selectedCredential.metadata)?.project"
                  label="Project"
                >
                  <span class="text-[12px] text-[var(--text-primary)]">
                    {{ (store.selectedCredential.apiKeyMetadata || store.selectedCredential.metadata)?.project }}
                  </span>
                </KeyValue>

                <KeyValue
                  v-if="(store.selectedCredential.apiKeyMetadata || store.selectedCredential.metadata)?.expiresAt"
                  label="Expires"
                >
                  <span class="text-[12px] tabular-nums font-mono text-[var(--text-primary)]">
                    {{ new Date((store.selectedCredential.apiKeyMetadata || store.selectedCredential.metadata)!.expiresAt!).toLocaleDateString() }}
                  </span>
                </KeyValue>

                <KeyValue
                  v-if="(store.selectedCredential.apiKeyMetadata || store.selectedCredential.metadata)?.lastUsed"
                  label="Last Used"
                >
                  <span class="text-[12px] tabular-nums font-mono text-[var(--text-primary)]">
                    {{ formatTimeAgo((store.selectedCredential.apiKeyMetadata || store.selectedCredential.metadata)!.lastUsed!) }}
                  </span>
                </KeyValue>
              </div>

              <!-- Scopes -->
              <div
                v-if="
                  (store.selectedCredential.apiKeyMetadata || store.selectedCredential.metadata)?.scopes &&
                  (store.selectedCredential.apiKeyMetadata || store.selectedCredential.metadata)!.scopes!.length > 0
                "
                class="pt-2 border-t border-[var(--border-subtle)]"
              >
                <p class="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1.5">
                  Assigned Scopes
                </p>
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="s in (store.selectedCredential.apiKeyMetadata || store.selectedCredential.metadata)!.scopes"
                    :key="s"
                    class="px-2 py-0.5 text-[11px] font-mono rounded border bg-[var(--surface-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)]"
                  >
                    {{ s }}
                  </span>
                </div>
              </div>
            </div>

            <!-- B. SSH Key Metadata -->
            <div
              v-else-if="store.selectedCredential.kind === 'ssh-key' && store.selectedCredential.sshKeyMetadata"
              class="rounded-lg border p-4 space-y-3 bg-[var(--surface-primary)] border-[var(--border-subtle)]"
            >
              <h3 class="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                SSH Key Specifications
              </h3>
              <div class="grid grid-cols-2 gap-3">
                <KeyValue label="Key Algorithm">
                  <AppBadge tone="accent" size="sm" solid>
                    {{ store.selectedCredential.sshKeyMetadata.keyType?.toUpperCase() ?? 'ED25519' }}
                  </AppBadge>
                </KeyValue>

                <KeyValue label="Passphrase Protected">
                  <AppBadge
                    :tone="store.selectedCredential.sshKeyMetadata.passphraseProtected ? 'success' : 'warning'"
                    size="sm"
                  >
                    {{ store.selectedCredential.sshKeyMetadata.passphraseProtected ? 'Protected' : 'Unprotected' }}
                  </AppBadge>
                </KeyValue>
              </div>

              <div v-if="store.selectedCredential.sshKeyMetadata.fingerprint" class="pt-2 border-t border-[var(--border-subtle)]">
                <p class="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
                  SHA-256 Fingerprint
                </p>
                <div class="px-2.5 py-1.5 text-[11px] font-mono break-all rounded border bg-[var(--surface-secondary)] border-[var(--border-subtle)] text-[var(--text-primary)]">
                  {{ store.selectedCredential.sshKeyMetadata.fingerprint }}
                </div>
              </div>

              <!-- Public Key with copy -->
              <div v-if="store.selectedCredential.sshKeyMetadata.publicKey" class="pt-2 border-t border-[var(--border-subtle)]">
                <div class="flex items-center justify-between mb-1">
                  <p class="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                    Public Key
                  </p>
                  <button
                    type="button"
                    @click="copyPublicKey(store.selectedCredential!.sshKeyMetadata!.publicKey!)"
                    class="flex items-center gap-1 text-[11px] font-medium text-[var(--gold)] hover:underline"
                  >
                    <Check v-if="copiedPublicKey" :size="11" />
                    <Copy v-else :size="11" />
                    <span>{{ copiedPublicKey ? 'Copied' : 'Copy Public Key' }}</span>
                  </button>
                </div>
                <div class="px-2.5 py-1.5 text-[11px] font-mono break-all rounded border bg-[var(--surface-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)]">
                  {{ store.selectedCredential.sshKeyMetadata.publicKey }}
                </div>
              </div>
            </div>

            <!-- C. OAuth2 Metadata -->
            <div
              v-else-if="store.selectedCredential.kind === 'oauth2' && store.selectedCredential.oauth2Metadata"
              class="rounded-lg border p-4 space-y-3 bg-[var(--surface-primary)] border-[var(--border-subtle)]"
            >
              <h3 class="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                OAuth2 Client Configuration
              </h3>
              <div class="space-y-2">
                <KeyValue label="Client ID">
                  <span class="text-[12px] font-mono break-all text-[var(--text-primary)]">
                    {{ store.selectedCredential.oauth2Metadata.clientId }}
                  </span>
                </KeyValue>

                <KeyValue label="Grant Type">
                  <AppBadge tone="gold" size="sm">
                    {{ store.selectedCredential.oauth2Metadata.grantType ?? 'client_credentials' }}
                  </AppBadge>
                </KeyValue>

                <KeyValue v-if="store.selectedCredential.oauth2Metadata.tokenUrl" label="Token Endpoint">
                  <span class="text-[11px] font-mono truncate max-w-xs text-[var(--text-tertiary)]">
                    {{ store.selectedCredential.oauth2Metadata.tokenUrl }}
                  </span>
                </KeyValue>

                <KeyValue v-if="store.selectedCredential.oauth2Metadata.expiresAt" label="Token Expiry">
                  <span class="text-[12px] tabular-nums font-mono text-[var(--text-primary)]">
                    {{ new Date(store.selectedCredential.oauth2Metadata.expiresAt).toLocaleDateString() }}
                  </span>
                </KeyValue>
              </div>

              <!-- Scopes -->
              <div
                v-if="store.selectedCredential.oauth2Metadata.scopes && store.selectedCredential.oauth2Metadata.scopes.length > 0"
                class="pt-2 border-t border-[var(--border-subtle)]"
              >
                <p class="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1.5">
                  Authorized Scopes
                </p>
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="s in store.selectedCredential.oauth2Metadata.scopes"
                    :key="s"
                    class="px-2 py-0.5 text-[11px] font-mono rounded border bg-[var(--surface-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)]"
                  >
                    {{ s }}
                  </span>
                </div>
              </div>
            </div>

            <!-- D. Secure Note Metadata -->
            <div
              v-else-if="store.selectedCredential.kind === 'secure-note' && store.selectedCredential.secureNoteMetadata"
              class="rounded-lg border p-4 space-y-3 bg-[var(--surface-primary)] border-[var(--border-subtle)]"
            >
              <h3 class="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                Secure Note Properties
              </h3>
              <div class="grid grid-cols-3 gap-2">
                <KeyValue label="Format">
                  <AppBadge tone="accent" size="sm">
                    {{ store.selectedCredential.secureNoteMetadata.format?.toUpperCase() ?? 'MARKDOWN' }}
                  </AppBadge>
                </KeyValue>

                <KeyValue label="Sensitivity">
                  <AppBadge
                    :tone="store.selectedCredential.secureNoteMetadata.isSensitive ? 'danger' : 'neutral'"
                    size="sm"
                  >
                    {{ store.selectedCredential.secureNoteMetadata.isSensitive ? 'High (Audited)' : 'Standard' }}
                  </AppBadge>
                </KeyValue>

                <KeyValue label="Length">
                  <span class="text-[12px] tabular-nums font-mono text-[var(--text-primary)]">
                    {{ store.selectedCredential.secret.length }} chars
                  </span>
                </KeyValue>
              </div>
            </div>

            <!-- 5. Tags -->
            <FieldGroup v-if="store.selectedCredential.tags.length > 0" label="Tags">
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="tag in store.selectedCredential.tags"
                  :key="tag"
                  class="px-2 py-1 text-[11px] rounded-md border font-medium bg-[var(--surface-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)]"
                >
                  #{{ tag }}
                </span>
              </div>
            </FieldGroup>

            <!-- 6. Operational Notes (for non-secure-note where secret isn't the note itself) -->
            <FieldGroup
              v-if="store.selectedCredential.notes && store.selectedCredential.kind !== 'secure-note'"
              label="Notes"
            >
              <div class="px-3 py-2.5 text-[13px] rounded-md border whitespace-pre-wrap leading-relaxed bg-[var(--surface-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]">
                {{ store.selectedCredential.notes }}
              </div>
            </FieldGroup>

            <!-- 7. Audit & Timestamp Grid -->
            <div class="pt-5 border-t grid grid-cols-2 gap-4 border-[var(--border-subtle)]">
              <div>
                <p class="text-[10px] tracking-wider uppercase text-[var(--text-tertiary)]">Created</p>
                <p class="text-[12px] mt-0.5 tabular-nums font-mono text-[var(--text-primary)]">
                  {{ new Date(store.selectedCredential.createdAt).toLocaleString() }}
                </p>
              </div>
              <div>
                <p class="text-[10px] tracking-wider uppercase text-[var(--text-tertiary)]">Last Updated</p>
                <p class="text-[12px] mt-0.5 tabular-nums font-mono text-[var(--text-primary)]">
                  {{ new Date(store.selectedCredential.updatedAt).toLocaleString() }}
                </p>
              </div>
            </div>
          </div>
        </DetailContainer>
      </Motion>
    </template>
  </SplitLayout>

  <!-- Create Credential Modal -->
  <ModalShell :open="showCreateModal" maxWidth="34rem" @close="showCreateModal = false">
    <div class="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border-subtle)]">
      <div>
        <h2 class="text-[16px] font-semibold text-[var(--text-primary)]">
          New Credential
        </h2>
        <p class="text-[12px] text-[var(--text-tertiary)] mt-0.5">
          Store a new secure password, key, token, or encrypted note.
        </p>
      </div>
      <button
        type="button"
        @click="showCreateModal = false"
        class="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
      >
        <X :size="16" />
      </button>
    </div>

    <CredentialForm
      :default-kind="props.defaultKind"
      :allowed-kinds="props.allowedKinds"
      :is-edit="false"
      @submit="handleCreate"
      @cancel="showCreateModal = false"
    />
  </ModalShell>

  <!-- Edit Credential Modal -->
  <ModalShell
    :open="showEditModal && Boolean(store.selectedCredential)"
    maxWidth="34rem"
    @close="showEditModal = false"
  >
    <template v-if="store.selectedCredential">
      <div class="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border-subtle)]">
        <div>
          <h2 class="text-[16px] font-semibold text-[var(--text-primary)]">
            Edit {{ store.selectedCredential.title }}
          </h2>
          <p class="text-[12px] text-[var(--text-tertiary)] mt-0.5">
            Update credential metadata, secrets, or operational parameters.
          </p>
        </div>
        <button
          type="button"
          @click="showEditModal = false"
          class="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <X :size="16" />
        </button>
      </div>

      <CredentialForm
        :initial="store.selectedCredential"
        :allowed-kinds="props.allowedKinds"
        :is-edit="true"
        @submit="handleUpdate"
        @cancel="showEditModal = false"
      />
    </template>
  </ModalShell>

  <!-- Delete Confirmation Dialog -->
  <AppDialog
    :open="showDeleteConfirm"
    title="Delete Credential"
    confirm-label="Delete"
    :danger="true"
    :loading="isDeleting"
    @confirm="handleDelete"
    @cancel="showDeleteConfirm = false"
  >
    Are you sure you want to permanently delete "{{ store.selectedCredential?.title }}"? This item will be scrubbed from your vault and cannot be recovered.
  </AppDialog>
</template>
