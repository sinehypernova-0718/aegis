<script setup lang="ts">
/**
 * ApiKeyDetail — API-key / access-token presentation (design spec §5.3).
 * Provider, environment, project, expiry, last use and scopes are surfaced
 * as operational context around the secret.
 */
import { computed } from 'vue';
import { Fingerprint } from 'lucide-vue-next';
import type { CredentialDetail } from '@/types';
import AppBadge from '@/components/ui/AppBadge.vue';
import { formatRelativeTime } from '@/utils/relativeTime';

const props = defineProps<{ credential: CredentialDetail }>();

const meta = computed(() => props.credential.apiKeyMetadata || props.credential.metadata);

function environmentTone(
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

</script>

<template>
  <section
    v-if="meta"
    class="rounded-xl border p-4 space-y-4"
    :style="{ background: 'var(--surface-primary)', borderColor: 'var(--border-subtle)' }"
  >
    <div class="flex items-center gap-2">
      <Fingerprint :size="14" :style="{ color: 'var(--type-api-key)' }" aria-hidden="true" />
      <h3 class="a-heading text-[13px]">API Configuration &amp; Telemetry</h3>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div v-if="meta.provider" class="rounded-lg border p-3" :style="{ borderColor: 'var(--border-subtle)', background: 'var(--surface-secondary)' }">
        <p class="a-label mb-1">Provider</p>
        <p class="text-[12px] font-medium" :style="{ color: 'var(--text-primary)' }">{{ meta.provider }}</p>
      </div>

      <div v-if="meta.environment" class="rounded-lg border p-3" :style="{ borderColor: 'var(--border-subtle)', background: 'var(--surface-secondary)' }">
        <p class="a-label mb-1">Environment</p>
        <AppBadge :tone="environmentTone(meta.environment)" size="sm" solid>{{ meta.environment }}</AppBadge>
      </div>

      <div v-if="meta.project" class="rounded-lg border p-3" :style="{ borderColor: 'var(--border-subtle)', background: 'var(--surface-secondary)' }">
        <p class="a-label mb-1">Project</p>
        <p class="text-[12px]" :style="{ color: 'var(--text-primary)' }">{{ meta.project }}</p>
      </div>

      <div v-if="meta.expiresAt" class="rounded-lg border p-3" :style="{ borderColor: 'var(--border-subtle)', background: 'var(--surface-secondary)' }">
        <p class="a-label mb-1">Expires</p>
        <p class="text-[12px] tabular-nums font-mono" :style="{ color: 'var(--text-primary)' }">
          {{ new Date(meta.expiresAt).toLocaleDateString() }}
        </p>
      </div>

      <div v-if="meta.lastUsed" class="rounded-lg border p-3" :style="{ borderColor: 'var(--border-subtle)', background: 'var(--surface-secondary)' }">
        <p class="a-label mb-1">Last used</p>
        <p class="text-[12px] tabular-nums font-mono" :style="{ color: 'var(--text-primary)' }">
          {{ formatRelativeTime(meta.lastUsed) }}
        </p>
      </div>
    </div>

    <div v-if="meta.scopes && meta.scopes.length > 0" class="pt-3 border-t" :style="{ borderColor: 'var(--border-subtle)' }">
      <p class="a-label mb-2">Assigned scopes</p>
      <div class="flex flex-wrap gap-1.5">
        <span
          v-for="scope in meta.scopes"
          :key="scope"
          class="px-2 py-0.5 text-[11px] font-mono rounded border"
          :style="{ background: 'var(--surface-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }"
        >
          {{ scope }}
        </span>
      </div>
    </div>
  </section>
</template>
