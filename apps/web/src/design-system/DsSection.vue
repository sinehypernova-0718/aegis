<script setup lang="ts">
/** DsSection — showcase scaffolding: titled glass block with description. */
import GlassPanel from '@/components/ui/GlassPanel.vue';

interface Props {
	title: string;
	description?: string;
	id?: string;
}

defineProps<Props>();
</script>

<template>
  <GlassPanel depth="standard" :radius="'var(--radius-xl)'" padding="1.5rem" as="section" class="mb-6">
    <div :id="id" class="scroll-mt-24">
      <h2 class="a-heading mb-1">{{ title }}</h2>
      <p v-if="description" class="a-supporting mb-4" :style="{ color: 'var(--text-tertiary)' }">{{ description }}</p>
      <slot />
    </div>
  </GlassPanel>
</template>
