<script setup lang="ts">
import { ref, computed, watch, useTemplateRef } from 'vue';
import {
	Key,
	Terminal,
	Shield,
	FileText,
	Globe,
	Fingerprint,
	ArrowLeft,
	ArrowRight,
	PenLine,
	Check,
} from 'lucide-vue-next';
import type {
	CredentialDetail,
	CredentialKind,
	CreateCredentialInput,
	ApiKeyMetadata,
	OAuth2Metadata,
	SshKeyMetadata,
	SecureNoteMetadata,
} from '@/types';
import { CREDENTIAL_KINDS, CATEGORIES } from '@/services/api/contracts';
import {
	OTHER_PROVIDER_ID,
	findProviderById,
	matchProviderFromText,
	type Provider,
} from '@/services/providers';
import AppButton from '@/components/ui/AppButton.vue';
import AppSelect, { type AppSelectOption } from '@/components/ui/AppSelect.vue';
import AppDateInput from '@/components/ui/AppDateInput.vue';
import ProviderLogo from '@/components/ui/ProviderLogo.vue';
import ProviderSelect from '@/components/ui/ProviderSelect.vue';
import ScopeTagInput from '@/components/ui/ScopeTagInput.vue';
import { controlBaseClass, controlStyle, focusStyle, errorStyle } from '@/components/ui/formStyles';

interface Props {
	initial?: CredentialDetail | null | undefined;
	defaultKind?: CredentialKind | undefined;
	allowedKinds?: CredentialKind[] | undefined;
	isEdit?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	initial: null,
	isEdit: false,
});

const emit = defineEmits<{
	submit: [data: CreateCredentialInput];
	cancel: [];
}>();

const availableKinds = computed(() => {
	if (props.allowedKinds && props.allowedKinds.length > 0) {
		return CREDENTIAL_KINDS.filter((k) => props.allowedKinds!.includes(k.value));
	}
	return CREDENTIAL_KINDS;
});

// ---------------------------------------------------------------------------
// Provider (step 1) — the central "which credential is this?" axis.
// ---------------------------------------------------------------------------

function initialProviderId(): string {
	if (props.isEdit && props.initial) {
		const matched = matchProviderFromText(props.initial.title);
		return matched?.id ?? OTHER_PROVIDER_ID;
	}
	return '';
}

const providerId = ref<string>(initialProviderId());
const otherProviderName = ref<string>('');

const activeProvider = computed<Provider | undefined>(() => findProviderById(providerId.value));

const providerName = computed(() => {
	if (providerId.value === OTHER_PROVIDER_ID) return otherProviderName.value.trim();
	return activeProvider.value?.name ?? '';
});

// ---------------------------------------------------------------------------
// Kind (step 1) + shared fields (step 2)
// ---------------------------------------------------------------------------

const kind = ref<CredentialKind>(
	props.initial?.kind ??
		props.defaultKind ??
		(props.allowedKinds && props.allowedKinds[0]) ??
		'password',
);

const step = ref<1 | 2>(props.isEdit ? 2 : 1);

const title = ref(props.initial?.title ?? '');
const titleDirty = ref(Boolean(props.initial?.title));
const username = ref(props.initial?.username ?? '');
const secret = ref('');
const url = ref(props.initial?.url ?? '');
const category = ref(props.initial?.category ?? '');
const tagsStr = ref(props.initial?.tags?.join(', ') ?? '');
const notes = ref(props.initial?.notes ?? '');

// API Key & Access Token
const apiKeyProvider = ref(
	props.initial?.apiKeyMetadata?.provider ?? props.initial?.metadata?.provider ?? '',
);
const apiKeyProject = ref(
	props.initial?.apiKeyMetadata?.project ?? props.initial?.metadata?.project ?? '',
);
const apiKeyEnv = ref<string>(
	props.initial?.apiKeyMetadata?.environment ??
		props.initial?.metadata?.environment ??
		'production',
);
const apiKeyExpiresAt = ref(
	props.initial?.apiKeyMetadata?.expiresAt ?? props.initial?.metadata?.expiresAt ?? '',
);

// SSH Key
const sshKeyType = ref<string>(props.initial?.sshKeyMetadata?.keyType ?? 'ed25519');
const sshPassphraseProtected = ref<boolean>(
	props.initial?.sshKeyMetadata?.passphraseProtected ?? true,
);
const sshPublicKey = ref(props.initial?.sshKeyMetadata?.publicKey ?? '');
const sshFingerprint = ref(props.initial?.sshKeyMetadata?.fingerprint ?? '');

// OAuth2
const oauthAppName = ref(props.initial?.oauth2Metadata?.appName ?? (props.initial?.oauth2Metadata?.clientId ? props.initial.title : ''));
const oauthClientId = ref(props.initial?.oauth2Metadata?.clientId ?? '');
const oauthTokenUrl = ref(props.initial?.oauth2Metadata?.tokenUrl ?? '');
const oauthAuthUrl = ref(props.initial?.oauth2Metadata?.authUrl ?? '');
const oauthGrantType = ref<string>(
	props.initial?.oauth2Metadata?.grantType ?? 'client_credentials',
);
const oauthExpiresAt = ref(props.initial?.oauth2Metadata?.expiresAt ?? '');

// Scope tag editors (n8n-style). Seeded from any existing metadata.
const apiKeyScopes = ref<string[]>(
	[...(props.initial?.apiKeyMetadata?.scopes ?? props.initial?.metadata?.scopes ?? [])],
);
const oauthScopes = ref<string[]>([...(props.initial?.oauth2Metadata?.scopes ?? [])]);

// Secure Note
const noteFormat = ref<string>(props.initial?.secureNoteMetadata?.format ?? 'markdown');
const noteIsSensitive = ref<boolean>(props.initial?.secureNoteMetadata?.isSensitive ?? true);

// Select option sets. The selects are string-modeled; the literal tuples below
// narrow each value back to its union at payload build time.
const ENVIRONMENTS = ['production', 'staging', 'development', 'test'] as const;
const SSH_KEY_TYPES = ['ed25519', 'rsa', 'ecdsa'] as const;
const OAUTH_GRANT_TYPES = [
	'authorization_code',
	'client_credentials',
	'refresh_token',
	'implicit',
] as const;
const NOTE_FORMATS = ['plain', 'markdown'] as const;

const ENV_OPTIONS: AppSelectOption[] = [
	{ value: 'production', label: 'Production' },
	{ value: 'staging', label: 'Staging' },
	{ value: 'development', label: 'Development' },
	{ value: 'test', label: 'Test' },
];
const SSH_KEY_TYPE_OPTIONS: AppSelectOption[] = [
	{ value: 'ed25519', label: 'ED25519 (Recommended)' },
	{ value: 'rsa', label: 'RSA 4096-bit' },
	{ value: 'ecdsa', label: 'ECDSA' },
];
const OAUTH_GRANT_TYPE_OPTIONS: AppSelectOption[] = [
	{ value: 'client_credentials', label: 'Client Credentials' },
	{ value: 'authorization_code', label: 'Authorization Code' },
	{ value: 'refresh_token', label: 'Refresh Token' },
	{ value: 'implicit', label: 'Implicit' },
];
const NOTE_FORMAT_OPTIONS: AppSelectOption[] = [
	{ value: 'markdown', label: 'Markdown' },
	{ value: 'plain', label: 'Plain Text' },
];
const CATEGORY_OPTIONS: AppSelectOption[] = [
	{ value: '', label: 'Uncategorized' },
	...CATEGORIES.filter((c) => c !== 'All').map((c) => ({ value: c, label: c })),
];

/** Recover the typed literal from a string-backed select value. */
function selectLiteral<T extends readonly string[]>(
	literals: T,
	value: string,
): T[number] | undefined {
	return literals.find((l) => l === value);
}

const errors = ref<Record<string, string>>({});
const focusedField = ref<string | null>(null);
const stepOneRef = useTemplateRef<HTMLElement>('stepOne');
const titleRef = useTemplateRef<HTMLInputElement>('titleInput');

function getKindIcon(k: CredentialKind) {
	switch (k) {
		case 'password':
			return Key;
		case 'api-key':
			return Fingerprint;
		case 'access-token':
			return Shield;
		case 'ssh-key':
			return Terminal;
		case 'oauth2':
			return Globe;
		case 'secure-note':
			return FileText;
	}
}

function kindLabel(k: CredentialKind): string {
	return CREDENTIAL_KINDS.find((entry) => entry.value === k)?.label ?? k;
}

/** Sort kinds so the provider's common kinds surface first. */
const orderedKinds = computed(() => {
	const primary = activeProvider.value?.primaryKinds ?? [];
	return [...availableKinds.value].sort((a, b) => {
		const ai = primary.indexOf(a.value);
		const bi = primary.indexOf(b.value);
		if (ai === -1 && bi === -1) return 0;
		if (ai === -1) return 1;
		if (bi === -1) return -1;
		return ai - bi;
	});
});

// Auto-derive a sensible title and URL while the user has not hand-edited them.
function syncDerivedFields(): void {
	const name = providerName.value;
	if (!titleDirty.value && name.length > 0) {
		title.value = `${name} — ${kindLabel(kind.value)}`;
	}
	if (activeProvider.value?.url && url.value.trim().length === 0) {
		url.value = activeProvider.value.url;
	}
}

watch(providerId, () => {
	const provider = activeProvider.value;
	if (provider && !props.isEdit) {
		kind.value = provider.defaultKind;
	}
	if (otherProviderName.value.length === 0 || provider) {
		// switching back to a catalog provider clears the stale custom name
		if (provider) otherProviderName.value = '';
	}
	syncDerivedFields();
});

watch(otherProviderName, syncDerivedFields);

watch(kind, () => {
	if (!titleDirty.value) syncDerivedFields();
});

function chooseKind(next: CredentialKind): void {
	kind.value = next;
}

function goToStepTwo(): void {
	if (providerId.value.length === 0) {
		errors.value = { ...errors.value, provider: 'Select a provider or choose Other' };
		stepOneRef.value?.scrollIntoView({ block: 'nearest' });
		return;
	}
	if (providerId.value === OTHER_PROVIDER_ID && otherProviderName.value.trim().length === 0) {
		errors.value = { ...errors.value, provider: 'Name the custom provider' };
		return;
	}
	const { provider: _drop, ...rest } = errors.value;
	errors.value = rest;
	step.value = 2;
	void Promise.resolve().then(() => titleRef.value?.focus());
}

const activeSuggestions = computed<readonly string[]>(() => activeProvider.value?.scopes ?? []);

const showApiScopes = computed(() => kind.value === 'api-key' || kind.value === 'access-token');
const showOauthScopes = computed(() => kind.value === 'oauth2');

function validate(): boolean {
	const errs: Record<string, string> = {};
	if (!title.value.trim()) {
		errs.title = 'Title is required';
	} else if (title.value.length > 128) {
		errs.title = 'Title must be 128 characters or less';
	}

	if (!secret.value.trim() && !props.isEdit) {
		if (kind.value === 'secure-note') {
			errs.secret = 'Note content is required';
		} else {
			errs.secret = 'Secret is required';
		}
	}

	if (kind.value === 'oauth2' && !oauthClientId.value.trim()) {
		errs.oauthClientId = 'Client ID is required';
	}

	errors.value = errs;
	return Object.keys(errs).length === 0;
}

function handleSubmit() {
	if (!validate()) return;

	const tags = tagsStr.value
		.split(',')
		.map((t) => t.trim())
		.filter(Boolean);

	const finalSecret = secret.value.trim() || (props.initial?.secret ?? '');

	const payload: CreateCredentialInput = {
		kind: kind.value,
		title: title.value.trim(),
		username: username.value.trim() || undefined,
		secret: finalSecret,
		url: url.value.trim() || undefined,
		category: category.value.trim() || undefined,
		tags: tags.length > 0 ? tags : undefined,
		notes: notes.value.trim() || (kind.value === 'secure-note' ? finalSecret : undefined),
	};

	// Build type-specific metadata
	if (kind.value === 'api-key' || kind.value === 'access-token') {
		const scopesArr = [...apiKeyScopes.value];
		const apiMeta: ApiKeyMetadata = {
			provider: providerName.value || apiKeyProvider.value.trim() || undefined,
			project: apiKeyProject.value.trim() || undefined,
			environment: selectLiteral(ENVIRONMENTS, apiKeyEnv.value) ?? 'production',
			expiresAt: apiKeyExpiresAt.value.trim() || undefined,
			scopes: scopesArr.length > 0 ? scopesArr : undefined,
		};
		payload.apiKeyMetadata = apiMeta;
		payload.metadata = apiMeta; // backwards compatibility
	} else if (kind.value === 'ssh-key') {
		const sshMeta: SshKeyMetadata = {
			keyType: selectLiteral(SSH_KEY_TYPES, sshKeyType.value) ?? 'ed25519',
			passphraseProtected: sshPassphraseProtected.value,
			publicKey: sshPublicKey.value.trim() || undefined,
			fingerprint: sshFingerprint.value.trim() || undefined,
		};
		payload.sshKeyMetadata = sshMeta;
	} else if (kind.value === 'oauth2') {
		const scopesArr = [...oauthScopes.value];
		const oauthMeta: OAuth2Metadata = {
			appName: oauthAppName.value.trim() || undefined,
			clientId: oauthClientId.value.trim(),
			tokenUrl: oauthTokenUrl.value.trim() || undefined,
			authUrl: oauthAuthUrl.value.trim() || undefined,
			grantType: selectLiteral(OAUTH_GRANT_TYPES, oauthGrantType.value) ?? 'client_credentials',
			scopes: scopesArr.length > 0 ? scopesArr : undefined,
			expiresAt: oauthExpiresAt.value.trim() || undefined,
		};
		payload.oauth2Metadata = oauthMeta;
	} else if (kind.value === 'secure-note') {
		const noteMeta: SecureNoteMetadata = {
			format: selectLiteral(NOTE_FORMATS, noteFormat.value) ?? 'markdown',
			isSensitive: noteIsSensitive.value,
			characterCount: finalSecret.length,
		};
		payload.secureNoteMetadata = noteMeta;
	}

	emit('submit', payload);
}

function inputStyle(fieldName: string) {
	const isFocused = focusedField.value === fieldName;
	const hasError = Boolean(errors.value[fieldName]);
	return {
		...controlStyle,
		...(isFocused && !hasError ? focusStyle : {}),
		...(hasError ? errorStyle : {}),
	};
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-4">
    <!-- Progress -->
    <div v-if="!isEdit" class="flex items-center gap-2 text-[11px] font-medium">
      <span
        class="inline-flex items-center gap-1.5"
        :style="{ color: step === 1 ? 'var(--gold)' : 'var(--text-tertiary)' }"
      >
        <span
          class="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px]"
          :style="{
            background: step === 1 ? 'var(--gold-surface)' : 'var(--surface-tertiary)',
            border: `1px solid ${step === 1 ? 'var(--gold-border)' : 'var(--border-subtle)'}`,
          }"
        >1</span>
        Provider
      </span>
      <span class="h-px flex-1 bg-[var(--border-subtle)]" />
      <span
        class="inline-flex items-center gap-1.5"
        :style="{ color: step === 2 ? 'var(--gold)' : 'var(--text-tertiary)' }"
      >
        <span
          class="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px]"
          :style="{
            background: step === 2 ? 'var(--gold-surface)' : 'var(--surface-tertiary)',
            border: `1px solid ${step === 2 ? 'var(--gold-border)' : 'var(--border-subtle)'}`,
          }"
        >2</span>
        Details
      </span>
    </div>

    <!-- STEP 1 — provider + kind -->
    <template v-if="step === 1">
      <div ref="stepOne">
        <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
          Which credential is this?
        </label>

        <ProviderSelect
          v-model="providerId"
          :other-name="otherProviderName"
          placeholder="Select a provider..."
          :error="errors.provider"
        />

        <div v-if="providerId === OTHER_PROVIDER_ID" class="mt-2.5">
          <input
            v-model="otherProviderName"
            type="text"
            placeholder="Custom provider name (e.g. Internal Billing)"
            :class="controlBaseClass"
            class="px-3 py-2 text-[13px]"
            :style="inputStyle('provider')"
            @focus="focusedField = 'provider'"
            @blur="focusedField = null"
          />
        </div>
        <p v-if="errors.provider" class="text-[11px] mt-1 text-[var(--danger)]">{{ errors.provider }}</p>
      </div>

      <div v-if="providerId">
        <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
          What is it?
        </label>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          <button
            v-for="k in orderedKinds"
            :key="k.value"
            type="button"
            @click="chooseKind(k.value)"
            class="kind-option flex items-center gap-2 px-3 py-2 text-[12px] font-medium rounded-md border text-left"
            :style="{
              background: kind === k.value ? 'var(--gold-surface)' : 'var(--surface-input)',
              borderColor: kind === k.value ? 'var(--gold-border)' : 'var(--border-subtle)',
              color: kind === k.value ? 'var(--gold)' : 'var(--text-secondary)',
              boxShadow: kind === k.value ? 'var(--shadow-gold), var(--specular-rim-gold)' : 'none',
            }"
          >
            <component :is="getKindIcon(k.value)" :size="13" class="shrink-0" />
            <span class="truncate">{{ k.label }}</span>
          </button>
        </div>
      </div>
    </template>

    <!-- STEP 2 — details -->
    <template v-else>
      <!-- Provider summary (compact, editable) -->
      <div
        class="flex items-center gap-2.5 px-3 py-2 rounded-md border"
        :style="{ background: 'var(--surface-input)', borderColor: 'var(--border-subtle)' }"
      >
        <ProviderLogo :provider-id="providerId" :name="providerName" :size="24" />
        <div class="min-w-0 flex-1">
          <p class="text-[13px] font-medium text-[var(--text-primary)] truncate">
            {{ providerName || 'Unspecified provider' }}
          </p>
          <p class="text-[11px] text-[var(--text-tertiary)]">{{ kindLabel(kind) }}</p>
        </div>
        <button
          v-if="!isEdit"
          type="button"
          class="inline-flex items-center gap-1 text-[11px] text-[var(--gold)] hover:underline"
          @click="step = 1"
        >
          <PenLine :size="11" /> Change
        </button>
      </div>

      <!-- Title -->
      <div>
        <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
          Title *
        </label>
        <input
          ref="titleInput"
          v-model="title"
          type="text"
          :placeholder="providerName ? `${providerName} — ${kindLabel(kind)}` : 'e.g. GitHub Production'"
          :class="controlBaseClass"
          class="px-3 py-2 text-[13px]"
          :style="inputStyle('title')"
          @input="titleDirty = true"
          @focus="focusedField = 'title'"
          @blur="focusedField = null"
          autofocus
        />
        <p v-if="errors.title" class="text-[11px] mt-1 text-[var(--danger)]">{{ errors.title }}</p>
      </div>

      <!-- Kind-Specific Dynamic Fields -->
      <!-- 1. Password -->
      <template v-if="kind === 'password'">
        <div>
          <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
            Username / Email
          </label>
          <input
            v-model="username"
            type="text"
            placeholder="admin@aegis.local"
            :class="controlBaseClass"
            class="px-3 py-2 text-[13px]"
            :style="inputStyle('username')"
            @focus="focusedField = 'username'"
            @blur="focusedField = null"
          />
        </div>

        <div>
          <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
            Password for {{ providerName || 'this service' }} *
          </label>
          <input
            v-model="secret"
            type="password"
            :placeholder="isEdit ? '(leave blank to keep current)' : 'Enter secure password'"
            :class="controlBaseClass"
            class="px-3 py-2 text-[13px] font-mono"
            :style="inputStyle('secret')"
            @focus="focusedField = 'secret'"
            @blur="focusedField = null"
          />
          <p v-if="errors.secret" class="text-[11px] mt-1 text-[var(--danger)]">{{ errors.secret }}</p>
        </div>

        <div>
          <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
            Website / Login URL
          </label>
          <input
            v-model="url"
            type="url"
            placeholder="https://..."
            :class="controlBaseClass"
            class="px-3 py-2 text-[13px]"
            :style="inputStyle('url')"
            @focus="focusedField = 'url'"
            @blur="focusedField = null"
          />
        </div>
      </template>

      <!-- 2. API Key -->
      <template v-else-if="kind === 'api-key'">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
              Provider
            </label>
            <input
              v-model="apiKeyProvider"
              type="text"
              :placeholder="providerName || 'e.g. Stripe, OpenAI'"
              :class="controlBaseClass"
              class="px-3 py-2 text-[13px]"
              :style="inputStyle('apiKeyProvider')"
              @focus="focusedField = 'apiKeyProvider'"
              @blur="focusedField = null"
            />
          </div>
          <div>
            <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
              Environment
            </label>
            <AppSelect v-model="apiKeyEnv" class="w-full" :options="ENV_OPTIONS" size="md" />
          </div>
        </div>

        <div>
          <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
            API Key Secret *
          </label>
          <textarea
            v-model="secret"
            :placeholder="isEdit ? '(leave blank to keep current)' : 'sk_live_...'"
            rows="2"
            :class="controlBaseClass"
            class="px-3 py-2 text-[13px] font-mono resize-none"
            :style="inputStyle('secret')"
            @focus="focusedField = 'secret'"
            @blur="focusedField = null"
          />
          <p v-if="errors.secret" class="text-[11px] mt-1 text-[var(--danger)]">{{ errors.secret }}</p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
              Project / Application
            </label>
            <input
              v-model="apiKeyProject"
              type="text"
              placeholder="aegis-prod"
              :class="controlBaseClass"
              class="px-3 py-2 text-[13px]"
              :style="inputStyle('apiKeyProject')"
              @focus="focusedField = 'apiKeyProject'"
              @blur="focusedField = null"
            />
          </div>
          <div>
            <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
              Expires At
            </label>
            <AppDateInput v-model="apiKeyExpiresAt" size="md" />
          </div>
        </div>

        <div v-if="showApiScopes">
          <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
            Scopes / Permissions
          </label>
          <ScopeTagInput
            v-model="apiKeyScopes"
            :suggestions="activeSuggestions"
            placeholder="Add a scope and press Enter"
          />
        </div>

        <div>
          <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
            API Endpoint URL
          </label>
          <input
            v-model="url"
            type="url"
            placeholder="https://api.stripe.com"
            :class="controlBaseClass"
            class="px-3 py-2 text-[13px]"
            :style="inputStyle('url')"
            @focus="focusedField = 'url'"
            @blur="focusedField = null"
          />
        </div>
      </template>

      <!-- 3. Access Token -->
      <template v-else-if="kind === 'access-token'">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
              Token Identifier / Role
            </label>
            <input
              v-model="username"
              type="text"
              placeholder="arn:aws:iam::role/deploy"
              :class="controlBaseClass"
              class="px-3 py-2 text-[13px]"
              :style="inputStyle('username')"
              @focus="focusedField = 'username'"
              @blur="focusedField = null"
            />
          </div>
          <div>
            <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
              Provider
            </label>
            <input
              v-model="apiKeyProvider"
              type="text"
              :placeholder="providerName || 'e.g. AWS, Cloudflare'"
              :class="controlBaseClass"
              class="px-3 py-2 text-[13px]"
              :style="inputStyle('apiKeyProvider')"
              @focus="focusedField = 'apiKeyProvider'"
              @blur="focusedField = null"
            />
          </div>
        </div>

        <div>
          <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
            {{ providerName ? `${providerName} ` : '' }}Access Token *
          </label>
          <textarea
            v-model="secret"
            :placeholder="isEdit ? '(leave blank to keep current)' : 'ghp_... or eyJ...'"
            rows="2"
            :class="controlBaseClass"
            class="px-3 py-2 text-[13px] font-mono resize-none"
            :style="inputStyle('secret')"
            @focus="focusedField = 'secret'"
            @blur="focusedField = null"
          />
          <p v-if="errors.secret" class="text-[11px] mt-1 text-[var(--danger)]">{{ errors.secret }}</p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
              Environment
            </label>
            <AppSelect v-model="apiKeyEnv" class="w-full" :options="ENV_OPTIONS" size="md" />
          </div>
          <div>
            <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
              Expires At
            </label>
            <AppDateInput v-model="apiKeyExpiresAt" size="md" />
          </div>
        </div>

        <div v-if="showApiScopes">
          <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
            Scopes / Permissions
          </label>
          <ScopeTagInput
            v-model="apiKeyScopes"
            :suggestions="activeSuggestions"
            placeholder="Add a scope and press Enter"
          />
        </div>

        <div>
          <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
            Console / Management URL
          </label>
          <input
            v-model="url"
            type="url"
            placeholder="https://console.aws.amazon.com"
            :class="controlBaseClass"
            class="px-3 py-2 text-[13px]"
            :style="inputStyle('url')"
            @focus="focusedField = 'url'"
            @blur="focusedField = null"
          />
        </div>
      </template>

      <!-- 4. SSH Key -->
      <template v-else-if="kind === 'ssh-key'">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
              User / Host
            </label>
            <input
              v-model="username"
              type="text"
              placeholder="deploy@bastion.internal"
              :class="controlBaseClass"
              class="px-3 py-2 text-[13px]"
              :style="inputStyle('username')"
              @focus="focusedField = 'username'"
              @blur="focusedField = null"
            />
          </div>
          <div>
            <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
              Key Algorithm
            </label>
            <AppSelect v-model="sshKeyType" class="w-full" :options="SSH_KEY_TYPE_OPTIONS" size="md" />
          </div>
        </div>

        <div>
          <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
            Private Key *
          </label>
          <textarea
            v-model="secret"
            :placeholder="isEdit ? '(leave blank to keep current)' : '-----BEGIN OPENSSH PRIVATE KEY-----\n...'"
            rows="3"
            :class="controlBaseClass"
            class="px-3 py-2 text-[12px] font-mono resize-none"
            :style="inputStyle('secret')"
            @focus="focusedField = 'secret'"
            @blur="focusedField = null"
          />
          <p v-if="errors.secret" class="text-[11px] mt-1 text-[var(--danger)]">{{ errors.secret }}</p>
        </div>

        <div>
          <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
            Public Key (optional)
          </label>
          <textarea
            v-model="sshPublicKey"
            placeholder="ssh-ed25519 AAAAC3... user@host"
            rows="2"
            :class="controlBaseClass"
            class="px-3 py-2 text-[12px] font-mono resize-none"
            :style="inputStyle('sshPublicKey')"
            @focus="focusedField = 'sshPublicKey'"
            @blur="focusedField = null"
          />
        </div>

        <div class="flex items-center gap-2 pt-1">
          <input
            id="ssh-passphrase-protected"
            v-model="sshPassphraseProtected"
            type="checkbox"
            class="rounded border-[var(--border-default)] accent-[var(--gold)]"
          />
          <label for="ssh-passphrase-protected" class="text-[12px] text-[var(--text-secondary)] select-none">
            Key is passphrase protected
          </label>
        </div>
      </template>

      <!-- 5. OAuth2 Client -->
      <template v-else-if="kind === 'oauth2'">
        <div>
          <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
            App / Application Name
          </label>
          <input
            v-model="oauthAppName"
            type="text"
            :placeholder="providerName ? `${providerName} Integration` : 'My Integration'"
            :class="controlBaseClass"
            class="px-3 py-2 text-[13px]"
            :style="inputStyle('oauthAppName')"
            @focus="focusedField = 'oauthAppName'"
            @blur="focusedField = null"
          />
        </div>

        <div>
          <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
            Client ID *
          </label>
          <input
            v-model="oauthClientId"
            type="text"
            placeholder="client_id_..."
            :class="controlBaseClass"
            class="px-3 py-2 text-[13px] font-mono"
            :style="inputStyle('oauthClientId')"
            @focus="focusedField = 'oauthClientId'"
            @blur="focusedField = null"
          />
          <p v-if="errors.oauthClientId" class="text-[11px] mt-1 text-[var(--danger)]">{{ errors.oauthClientId }}</p>
        </div>

        <div>
          <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
            Client Secret *
          </label>
          <input
            v-model="secret"
            type="password"
            :placeholder="isEdit ? '(leave blank to keep current)' : 'Enter client secret'"
            :class="controlBaseClass"
            class="px-3 py-2 text-[13px] font-mono"
            :style="inputStyle('secret')"
            @focus="focusedField = 'secret'"
            @blur="focusedField = null"
          />
          <p v-if="errors.secret" class="text-[11px] mt-1 text-[var(--danger)]">{{ errors.secret }}</p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
              Grant Type
            </label>
            <AppSelect v-model="oauthGrantType" class="w-full" :options="OAUTH_GRANT_TYPE_OPTIONS" size="md" />
          </div>
          <div>
            <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
              Token Endpoint URL
            </label>
            <input
              v-model="oauthTokenUrl"
              type="url"
              placeholder="https://oauth2.../token"
              :class="controlBaseClass"
              class="px-3 py-2 text-[12px]"
              :style="inputStyle('oauthTokenUrl')"
              @focus="focusedField = 'oauthTokenUrl'"
              @blur="focusedField = null"
            />
          </div>
        </div>

        <div>
          <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
            Authorization Endpoint URL (optional)
          </label>
          <input
            v-model="oauthAuthUrl"
            type="url"
            placeholder="https://.../authorize"
            :class="controlBaseClass"
            class="px-3 py-2 text-[12px]"
            :style="inputStyle('oauthAuthUrl')"
            @focus="focusedField = 'oauthAuthUrl'"
            @blur="focusedField = null"
          />
        </div>

        <div v-if="showOauthScopes">
          <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
            Scopes
          </label>
          <ScopeTagInput
            v-model="oauthScopes"
            :suggestions="activeSuggestions"
            placeholder="Add a scope and press Enter"
          />
        </div>
      </template>

      <!-- 6. Secure Note -->
      <template v-else-if="kind === 'secure-note'">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
              Note Format
            </label>
            <AppSelect v-model="noteFormat" class="w-full" :options="NOTE_FORMAT_OPTIONS" size="md" />
          </div>
          <div class="flex items-center gap-2 pt-4">
            <input
              id="note-sensitive"
              v-model="noteIsSensitive"
              type="checkbox"
              class="rounded border-[var(--border-default)] accent-[var(--gold)]"
            />
            <label for="note-sensitive" class="text-[12px] text-[var(--text-secondary)] select-none">
              High sensitivity (audit logged)
            </label>
          </div>
        </div>

        <div>
          <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
            Secure Content *
          </label>
          <textarea
            v-model="secret"
            :placeholder="isEdit ? '(leave blank to keep current)' : 'Write your encrypted notes here...'"
            rows="5"
            :class="controlBaseClass"
            class="px-3 py-2 text-[13px] font-mono resize-y"
            :style="inputStyle('secret')"
            @focus="focusedField = 'secret'"
            @blur="focusedField = null"
          />
          <p v-if="errors.secret" class="text-[11px] mt-1 text-[var(--danger)]">{{ errors.secret }}</p>
        </div>
      </template>

      <!-- Common Metadata: Category & Tags -->
      <div class="grid grid-cols-2 gap-3 pt-1">
        <div>
          <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
            Category
          </label>
          <AppSelect v-model="category" class="w-full" :options="CATEGORY_OPTIONS" size="md" />
        </div>
        <div>
          <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
            Tags (comma-separated)
          </label>
          <input
            v-model="tagsStr"
            type="text"
            placeholder="production, backup"
            :class="controlBaseClass"
            class="px-3 py-2 text-[12px]"
            :style="inputStyle('tagsStr')"
            @focus="focusedField = 'tagsStr'"
            @blur="focusedField = null"
          />
        </div>
      </div>

      <!-- Notes (for all except secure-note, where note content is the secret) -->
      <div v-if="kind !== 'secure-note'">
        <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
          Context / Operational Notes
        </label>
        <textarea
          v-model="notes"
          placeholder="Additional deployment details or rotation instructions..."
          rows="2"
          :class="controlBaseClass"
          class="px-3 py-2 text-[12px] resize-none"
          :style="inputStyle('notes')"
          @focus="focusedField = 'notes'"
          @blur="focusedField = null"
        />
      </div>
    </template>

    <!-- Action Buttons -->
    <div class="flex items-center justify-between gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
      <AppButton v-if="step === 2 && !isEdit" variant="ghost" size="sm" type="button" @click="step = 1">
        <ArrowLeft :size="13" />
        Back
      </AppButton>
      <span v-else />

      <div class="flex items-center gap-2.5">
        <AppButton variant="secondary" size="sm" type="button" @click="emit('cancel')">
          Cancel
        </AppButton>
        <AppButton v-if="step === 1" variant="gold" size="sm" type="button" @click="goToStepTwo">
          Continue
          <ArrowRight :size="13" />
        </AppButton>
        <AppButton v-else variant="gold" size="sm" type="submit">
          <Check v-if="isEdit" :size="13" />
          {{ isEdit ? 'Save Changes' : 'Create Credential' }}
        </AppButton>
      </div>
    </div>
  </form>
</template>

<style scoped>
/* Smooth, tactile kind selector. Transform is animated separately from the
   inline-styled color state so selection changes glide instead of snapping. */
.kind-option {
  transition:
    transform var(--duration-control, 160ms) var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1)),
    background-color var(--duration-control, 160ms) var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1)),
    border-color var(--duration-control, 160ms) var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1)),
    box-shadow var(--duration-control, 160ms) var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
  will-change: transform;
}
.kind-option:hover {
  transform: translateY(-1px);
}
.kind-option:active {
  transform: translateY(0) scale(0.985);
}
@media (prefers-reduced-motion: reduce) {
  .kind-option {
    transition: none;
  }
  .kind-option:hover,
  .kind-option:active {
    transform: none;
  }
}
</style>
