<script setup lang="ts">
/**
 * OAuth2Detail — OAuth2 client presentation (design spec §5.3).
 * Endpoints, grant type, scopes and expiry read as integration context.
 */
import { computed } from 'vue';
import { Globe } from 'lucide-vue-next';
import type { CredentialDetail } from '@/types';
import AppBadge from '@/components/ui/AppBadge.vue';

const props = defineProps<{ credential: CredentialDetail }>();

const meta = computed(() => props.credential.oauth2Metadata);
</script>

<template>
  <section
    v-if="meta"
    class="rounded-xl border p-4 space-y-4"
    :style="{ background: 'var(--surface-primary)', borderColor: 'var(--border-subtle)' }"
  >
    <div class="flex items-center gap-2">
      <Globe :size="14" :style="{ color: 'var(--gold)' }" aria-hidden="true" />
      <h3 class="a-heading text-[13px]">OAuth2 Client Configuration</h3>
    </div>

    <div class="space-y-3">
      <div v-if="meta.clientId" class="rounded-lg border p-3" :style="{ borderColor: 'var(--border-subtle)', background: 'var(--surface-secondary)' }">
        <p class="a-label mb-1">Client ID</p>
        <p class="text-[11px] font-mono break-all" :style="{ color: 'var(--text-primary)' }">{{ meta.clientId }}</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div class="rounded-lg border p-3" :style="{ borderColor: 'var(--border-subtle)', background: 'var(--surface-secondary)' }">
          <p class="a-label mb-1">Grant type</p>
          <AppBadge tone="gold" size="sm">{{ meta.grantType ?? 'client_credentials' }}</AppBadge>
        </div>

        <div v-if="meta.expiresAt" class="rounded-lg border p-3" :style="{ borderColor: 'var(--border-subtle)', background: 'var(--surface-secondary)' }">
          <p class="a-label mb-1">Token expiry</p>
          <p class="text-[12px] tabular-nums font-mono" :style="{ color: 'var(--text-primary)' }">
            {{ new Date(meta.expiresAt).toLocaleDateString() }}
          </p>
        </div>
      </div>

      <div v-if="meta.authUrl" class="rounded-lg border p-3" :style="{ borderColor: 'var(--border-subtle)', background: 'var(--surface-secondary)' }">
        <p class="a-label mb-1">Authorization endpoint</p>
        <p class="text-[11px] font-mono break-all" :style="{ color: 'var(--text-tertiary)' }">{{ meta.authUrl }}</p>
      </div>

      <div v-if="meta.tokenUrl" class="rounded-lg border p-3" :style="{ borderColor: 'var(--border-subtle)', background: 'var(--surface-secondary)' }">
        <p class="a-label mb-1">Token endpoint</p>
        <p class="text-[11px] font-mono break-all" :style="{ color: 'var(--text-tertiary)' }">{{ meta.tokenUrl }}</p>
      </div>
    </div>

    <div v-if="meta.scopes && meta.scopes.length > 0" class="pt-3 border-t" :style="{ borderColor: 'var(--border-subtle)' }">
      <p class="a-label mb-2">Authorized scopes</p>
      <div class="flex flex-wrap gap-1.5">
        <span
          v-for="scope in meta.scopes"
          :key="scope"
          class="px-2 py-0.5 text-[11px] font-mono rounded border break-all"
          :style="{ background: 'var(--surface-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }"
        >
          {{ scope }}
        </span>
      </div>
    </div>
  </section>
</template>