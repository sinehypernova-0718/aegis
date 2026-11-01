<script setup lang="ts">
import CredentialList from '@/components/vault/CredentialList.vue';
</script>

<template>
  <CredentialList
    title="Passwords & Vault Items"
    subtitle="Passwords, SSH keys, OAuth2 credentials & secure notes"
    :allowed-kinds="['password', 'ssh-key', 'oauth2', 'secure-note']"
    default-kind="password"
  />
</template>
