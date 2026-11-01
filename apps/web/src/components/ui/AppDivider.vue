<script setup lang="ts">
/** AppDivider — hairline rule; `gold` renders the premium gradient variant. */
interface Props {
	orientation?: 'horizontal' | 'vertical';
	gold?: boolean;
}

withDefaults(defineProps<Props>(), {
	orientation: 'horizontal',
	gold: false,
});
</script>

<template>
  <hr
    v-if="orientation === 'horizontal'"
    :class="gold ? 'a-gold-hairline' : 'border-0 border-t'"
    :style="gold ? undefined : { borderColor: 'var(--border-subtle)' }"
  />
  <div
    v-else
    class="self-stretch w-px"
    :style="{ background: gold ? 'var(--gold-border)' : 'var(--border-subtle)' }"
    aria-hidden="true"
  />
</template>
