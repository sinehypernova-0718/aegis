<script setup lang="ts">
import { computed } from 'vue';
import CredentialList from '@/components/vault/CredentialList.vue';
import { useVaultStore } from '@/stores/vaultStore';

const store = useVaultStore();
const items = computed(() => store.credentials.filter((c) => c.kind === 'oauth2'));
</script>

<template>
  <CredentialList
    title="OAuth2 Clients"
    subtitle="Client credentials, grant types & authorized scopes"
    :items="items"
    :allowed-kinds="['oauth2']"
    default-kind="oauth2"
  />
</template>