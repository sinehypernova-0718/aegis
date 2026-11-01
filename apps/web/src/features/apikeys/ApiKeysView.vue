<script setup lang="ts">
import CredentialList from '@/components/vault/CredentialList.vue';
import { useVaultStore } from '@/stores/vaultStore';

const store = useVaultStore();
</script>

<template>
  <CredentialList
    title="API Keys & Tokens"
    subtitle="Developer keys, access tokens & service infrastructure"
    :items="store.apiKeys"
    :allowed-kinds="['api-key', 'access-token']"
    default-kind="api-key"
  />
</template>
