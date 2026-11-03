<script setup lang="ts">
import {
	ArrowUpDown,
	Edit3,
	ExternalLink,
	FileText,
	Filter,
	Fingerprint,
	Globe,
	Key,
	Lock,
	Plus,
	Search,
	Shield,
	Tag,
	Terminal,
	Trash2,
	X,
} from 'lucide-vue-next';
import { AnimatePresence, Motion } from 'motion-v';
import { computed, ref } from 'vue';
import DetailContainer from '@/components/layout/DetailContainer.vue';
import DetailHeader from '@/components/layout/DetailHeader.vue';
import SplitLayout from '@/components/layout/SplitLayout.vue';
import SplitSidebarHeader from '@/components/layout/SplitSidebarHeader.vue';
import AppBadge from '@/components/ui/AppBadge.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppDialog from '@/components/ui/AppDialog.vue';
import AppSelect, { type AppSelectOption } from '@/components/ui/AppSelect.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import FieldGroup from '@/components/ui/FieldGroup.vue';
import ModalShell from '@/components/ui/ModalShell.vue';
import ProviderLogo from '@/components/ui/ProviderLogo.vue';
import CredentialForm from '@/components/vault/CredentialForm.vue';
import ApiKeyDetail from '@/components/vault/detail/ApiKeyDetail.vue';
import OAuth2Detail from '@/components/vault/detail/OAuth2Detail.vue';
import SecretField from '@/components/vault/detail/SecretField.vue';
import SecureNoteDetail from '@/components/vault/detail/SecureNoteDetail.vue';
import SshKeyDetail from '@/components/vault/detail/SshKeyDetail.vue';
import { springs } from '@/motion/tokens';
import { CATEGORIES, CREDENTIAL_KINDS } from '@/services/api/contracts';
import { matchProviderFromText } from '@/services/providers';
import { useVaultStore } from '@/stores/vaultStore';
import type { CredentialKind, CredentialSummary, UpdateCredentialInput } from '@/types';
import { formatRelativeTime } from '@/utils/relativeTime';

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

const showEditModal = ref(false);
/** Optimistic highlight: the clicked row lights up immediately, before the
 *  async detail fetch resolves, so selection never feels laggy. */
const pendingSelectionId = ref<string | null>(null);
const showDeleteConfirm = ref(false);
const isDeleting = ref(false);

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

function providerFor(title: string) {
	return matchProviderFromText(title);
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

const activeSelectionId = computed(
	() => pendingSelectionId.value ?? store.selectedCredential?.id ?? null,
);

/**
 * Scope guard (design spec §6 / D2): the detail workspace may only present a
 * credential whose kind belongs to this view. Combined with
 * store.navigate() clearing the selection, list/detail disagreement becomes
 * structurally impossible — a Secure Notes page can never render an SSH key.
 */
const selectionInScope = computed(() => {
	const selected = store.selectedCredential;
	if (!selected) return true;
	if (!props.allowedKinds || props.allowedKinds.length === 0) return true;
	return props.allowedKinds.includes(selected.kind);
});

async function selectItem(id: string) {
	pendingSelectionId.value = id;
	try {
		await store.selectCredential(id);
	} finally {
		pendingSelectionId.value = null;
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
          <AppButton variant="gold" size="sm" @click="store.openCreateModal()">
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
            aria-label="Search vault items"
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
          :title="sourceItems.length === 0 ? `No ${title.toLowerCase()} yet` : 'No matches'"
          :description="
            sourceItems.length === 0
              ? 'Create your first credential to get started.'
              : store.hasMoreCredentials
                ? 'No matches in the loaded items. Load more credentials to search further.'
                : 'Try adjusting the search or filters.'
          "
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
            @click="selectItem(item.id)"
            :aria-pressed="activeSelectionId === item.id"
            class="credential-row w-full text-left p-3 rounded-lg border relative group"
            :style="{
              background:
                activeSelectionId === item.id
                  ? 'var(--surface-elevated)'
                  : 'var(--surface-primary)',
              borderColor:
                activeSelectionId === item.id
                  ? 'var(--gold-border)'
                  : 'var(--border-subtle)',
              boxShadow:
                activeSelectionId === item.id
                  ? 'var(--shadow-gold), var(--specular-rim-gold)'
                  : 'var(--specular-rim-subtle)',
            }"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0 flex-1">
                <ProviderLogo
                  :provider-id="providerFor(item.title)?.id"
                  :name="providerFor(item.title)?.name ?? item.title"
                  :size="18"
                />
                <p class="text-[13px] font-medium truncate text-[var(--text-primary)]">
                  {{ item.title }}
                </p>
              </div>
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
                {{ formatRelativeTime(item.updatedAt) }}
              </span>
            </div>
          </button>
        </Motion>

        <button
          v-if="store.hasMoreCredentials"
          type="button"
          :disabled="store.isLoadingMoreCredentials"
          class="w-full rounded-md border px-3 py-2 text-xs text-[var(--text-secondary)] border-[var(--border-subtle)] bg-[var(--surface-primary)] disabled:opacity-50"
          @click="store.loadMoreCredentials()"
        >
          {{ store.isLoadingMoreCredentials ? 'Loading…' : 'Load more credentials' }}
        </button>
      </div>
    </template>

    <!-- Right Pane: Credential Detail View -->
    <template #detail>
      <AnimatePresence mode="wait" :initial="false">
      <!-- Empty placeholder when no credential is selected -->
      <Motion
        v-if="!store.selectedCredential || !selectionInScope"
        key="empty-detail"
        :initial="{ opacity: 0, scale: 0.99 }"
        :animate="{ opacity: 1, scale: 1, transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] } }"
        :exit="{ opacity: 0, scale: 0.995, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] } }"
        class="flex flex-col items-center justify-center h-full text-center px-4"
      >
        <div class="w-12 h-12 rounded-full flex items-center justify-center mb-3 bg-[var(--surface-secondary)] border border-[var(--border-subtle)] text-[var(--text-tertiary)]">
          <Lock :size="20" />
        </div>
        <p class="text-[14px] font-medium text-[var(--text-secondary)]">
          No credential selected
        </p>
        <p class="text-[12px] text-[var(--text-tertiary)] max-w-xs mt-1">
          Choose an item from the sidebar to view details, reveal secrets, or edit configuration.
        </p>
      </Motion>

      <!-- Credential Detail Content -->
      <Motion
        v-else
        :key="store.selectedCredential.id"
        :initial="{ opacity: 0, x: 18, scale: 0.985 }"
        :animate="{ opacity: 1, x: 0, scale: 1, transition: springs.snappy }"
        :exit="{ opacity: 0, x: -12, scale: 0.995, transition: { duration: 0.08, ease: [0.4, 0, 1, 1] } }"
        class="h-full overflow-y-auto overflow-x-hidden"
      >
        <DetailContainer maxWidth="720px">
          <!-- Detail Header -->
          <DetailHeader
            :title="store.selectedCredential.title"
            :subtitle="store.selectedCredential.category || 'Uncategorized'"
          >
            <template #leading>
              <ProviderLogo
                :provider-id="providerFor(store.selectedCredential.title)?.id"
                :name="providerFor(store.selectedCredential.title)?.name ?? store.selectedCredential.title"
                :size="34"
              />
            </template>
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
            <!-- 1. Secret material (shared secure presentation) -->
            <SecretField
              :secret="store.selectedCredential.secret"
              :label="getSecretLabel(store.selectedCredential.kind)"
              :credential-id="store.selectedCredential.id"
            />

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
            <!-- A. API Key & Access Token metadata -->
            <ApiKeyDetail
              v-if="
                store.selectedCredential.kind === 'api-key' ||
                store.selectedCredential.kind === 'access-token'
              "
              :credential="store.selectedCredential"
            />

            <!-- B. SSH Key metadata -->
            <SshKeyDetail
              v-if="store.selectedCredential.kind === 'ssh-key'"
              :credential="store.selectedCredential"
            />

            <!-- C. OAuth2 metadata -->
            <OAuth2Detail
              v-if="store.selectedCredential.kind === 'oauth2'"
              :credential="store.selectedCredential"
            />

            <!-- D. Secure Note metadata + document body -->
            <SecureNoteDetail
              v-if="store.selectedCredential.kind === 'secure-note'"
              :credential="store.selectedCredential"
            />

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
      </AnimatePresence>
    </template>
  </SplitLayout>

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

<style scoped>
/* Credential row selection: gentle, eased color/shadow swap so moving between
   items never snaps. Transform is kept tiny and only on hover/press. */
.credential-row {
  transition:
    background-color var(--duration-fast, 120ms) var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1)),
    border-color var(--duration-fast, 120ms) var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1)),
    box-shadow var(--duration-fast, 120ms) var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1)),
    transform var(--duration-fast, 120ms) var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
}
.credential-row:hover {
  transform: translateY(-1px);
}
.credential-row:active {
  transform: translateY(0) scale(0.995);
}
@media (prefers-reduced-motion: reduce) {
  .credential-row {
    transition: none;
  }
  .credential-row:hover,
  .credential-row:active {
    transform: none;
  }
}
</style>
