<script setup lang="ts">
import { computed } from 'vue';
import CredentialList from '@/components/vault/CredentialList.vue';
import { useVaultStore } from '@/stores/vaultStore';

const store = useVaultStore();
const items = computed(() => store.credentials.filter((c) => c.kind === 'ssh-key'));
</script>

<template>
  <CredentialList
    title="SSH Keys"
    subtitle="Private keys, bastion access & server identities"
    :items="items"
    :allowed-kinds="['ssh-key']"
    default-kind="ssh-key"
  />
</template>