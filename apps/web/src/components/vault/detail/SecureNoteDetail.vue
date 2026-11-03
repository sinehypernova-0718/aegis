<script setup lang="ts">
/**
 * SecureNoteDetail — document-like presentation for secure notes
 * (design spec §5.3). A note should read like a document, not like a form
 * field, so the body is rendered on a calm, solid reading surface.
 */
import { computed } from 'vue';
import { FileText } from 'lucide-vue-next';
import type { CredentialDetail } from '@/types';
import AppBadge from '@/components/ui/AppBadge.vue';

const props = defineProps<{ credential: CredentialDetail }>();

const meta = computed(() => props.credential.secureNoteMetadata);
const format = computed(() => (meta.value?.format ?? 'plain').toUpperCase());
const documentBody = computed(() => props.credential.notes?.trim() ?? '');
</script>

<template>
  <section class="space-y-4">
    <div
      class="rounded-xl border p-4 space-y-3"
      :style="{ background: 'var(--surface-primary)', borderColor: 'var(--border-subtle)' }"
    >
      <div class="flex items-center gap-2">
        <FileText :size="14" :style="{ color: 'var(--warning)' }" aria-hidden="true" />
        <h3 class="a-heading text-[13px]">Secure Note Properties</h3>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div class="rounded-lg border p-3" :style="{ borderColor: 'var(--border-subtle)', background: 'var(--surface-secondary)' }">
          <p class="a-label mb-1">Format</p>
          <AppBadge tone="accent" size="sm">{{ format }}</AppBadge>
        </div>

        <div class="rounded-lg border p-3" :style="{ borderColor: 'var(--border-subtle)', background: 'var(--surface-secondary)' }">
          <p class="a-label mb-1">Sensitivity</p>
          <AppBadge :tone="meta?.isSensitive ? 'danger' : 'neutral'" size="sm">
            {{ meta?.isSensitive ? 'High (audited)' : 'Standard' }}
          </AppBadge>
        </div>

        <div class="rounded-lg border p-3" :style="{ borderColor: 'var(--border-subtle)', background: 'var(--surface-secondary)' }">
          <p class="a-label mb-1">Length</p>
          <p class="text-[12px] tabular-nums font-mono" :style="{ color: 'var(--text-primary)' }">
            {{ meta?.characterCount ?? credential.secret.length }} chars
          </p>
        </div>
      </div>
    </div>

    <!-- Document-like reading surface (solid, high-contrast, no glass) -->
    <article
      v-if="documentBody"
      class="rounded-xl border p-5"
      :style="{ background: 'var(--surface-primary)', borderColor: 'var(--border-subtle)' }"
    >
      <p class="a-label mb-3">Note</p>
      <div
        class="text-[13px] leading-relaxed whitespace-pre-wrap break-words font-mono"
        :style="{ color: 'var(--text-primary)' }"
      >
        {{ documentBody }}
      </div>
    </article>
  </section>
</template>