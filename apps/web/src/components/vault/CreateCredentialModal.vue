<script setup lang="ts">
/**
 * CreateCredentialModal — the single, centralized credential-creation surface.
 *
 * Mounted once at the app shell so any view (Overview, a credential list, the
 * sidebar) can open it via `store.openCreateModal()` without navigating away.
 */
import { X } from 'lucide-vue-next';
import { useVaultStore } from '@/stores/vaultStore';
import type { CreateCredentialInput } from '@/types';
import ModalShell from '@/components/ui/ModalShell.vue';
import CredentialForm from '@/components/vault/CredentialForm.vue';

const store = useVaultStore();

async function handleCreate(data: CreateCredentialInput) {
	try {
		const summary = await store.createCredential(data);
		store.closeCreateModal();
		// Surface the freshly created credential for immediate inspection,
		// without changing the page the user opened the modal from.
		await store.selectCredential(summary.id);
	} catch {
		/* error notification handled in store */
	}
}
</script>

<template>
  <ModalShell :open="store.createModalOpen" maxWidth="38rem" @close="store.closeCreateModal()">
    <div class="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border-subtle)]">
      <div>
        <h2 class="text-[16px] font-semibold text-[var(--text-primary)]">New Credential</h2>
        <p class="text-[12px] text-[var(--text-tertiary)] mt-0.5">
          Pick a provider, then choose what kind of credential it is.
        </p>
      </div>
      <button
        type="button"
        class="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
        aria-label="Close"
        @click="store.closeCreateModal()"
      >
        <X :size="16" />
      </button>
    </div>

    <CredentialForm
      :is-edit="false"
      @submit="handleCreate"
      @cancel="store.closeCreateModal()"
    />
  </ModalShell>
</template>