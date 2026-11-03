<script setup lang="ts">
import { computed } from 'vue';
import CredentialList from '@/components/vault/CredentialList.vue';
import { useVaultStore } from '@/stores/vaultStore';

const store = useVaultStore();
const items = computed(() => store.credentials.filter((c) => c.kind === 'secure-note'));
</script>

<template>
  <CredentialList
    title="Secure Notes"
    subtitle="Encrypted runbooks, recovery notes & sensitive text"
    :items="items"
    :allowed-kinds="['secure-note']"
    default-kind="secure-note"
  />
</template>