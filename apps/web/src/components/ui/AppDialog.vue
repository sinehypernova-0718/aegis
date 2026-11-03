<script setup lang="ts">
import { computed, useId } from 'vue';
import { AlertTriangle } from 'lucide-vue-next';
import AppButton from './AppButton.vue';
import ModalShell from './ModalShell.vue';

interface Props {
	open: boolean;
	title: string;
	confirmLabel?: string;
	danger?: boolean;
	confirmVariant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'glass' | 'gold';
}

const props = withDefaults(defineProps<Props>(), {
	confirmLabel: 'Confirm',
	danger: false,
});

const resolvedConfirmVariant = computed(() => {
	if (props.confirmVariant) return props.confirmVariant;
	return props.danger ? 'danger' : 'gold';
});

const emit = defineEmits<{
	confirm: [];
	cancel: [];
}>();

const titleId = useId();
</script>

<template>
	<ModalShell :open="open" :labelled-by="titleId" @close="emit('cancel')">
		<div class="w-full max-w-md">
			<div class="flex items-center gap-2 mb-3">
				<AlertTriangle v-if="danger" :size="16" :style="{ color: 'var(--danger)' }" aria-hidden="true" />
				<h3 :id="titleId" class="text-[15px] font-semibold" :style="{ color: 'var(--text-primary)' }">{{ title }}</h3>
			</div>
			<div class="text-[13px] mb-5" :style="{ color: 'var(--text-secondary)' }">
				<slot />
			</div>
			<div class="flex justify-end gap-2">
				<AppButton variant="secondary" @click="emit('cancel')">Cancel</AppButton>
				<AppButton :variant="resolvedConfirmVariant" @click="emit('confirm')">{{ confirmLabel }}</AppButton>
			</div>
		</div>
	</ModalShell>
</template>
