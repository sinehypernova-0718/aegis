<script setup lang="ts">
import { ref, computed } from 'vue';
import { Key, Terminal, Shield, FileText, Globe, Fingerprint } from 'lucide-vue-next';
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
import AppButton from '@/components/ui/AppButton.vue';
import AppSelect, { type AppSelectOption } from '@/components/ui/AppSelect.vue';
import AppDateInput from '@/components/ui/AppDateInput.vue';
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

const kind = ref<CredentialKind>(
	props.initial?.kind ??
		props.defaultKind ??
		(props.allowedKinds && props.allowedKinds[0]) ??
		'password',
);

// Common fields
const title = ref(props.initial?.title ?? '');
const username = ref(props.initial?.username ?? '');
const secret = ref('');
const url = ref(props.initial?.url ?? '');
const category = ref(props.initial?.category ?? '');
const tagsStr = ref(props.initial?.tags?.join(', ') ?? '');
const notes = ref(props.initial?.notes ?? '');

// Kind-specific metadata fields
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
const apiKeyScopes = ref(
	props.initial?.apiKeyMetadata?.scopes?.join(', ') ??
		props.initial?.metadata?.scopes?.join(', ') ??
		'',
);

// SSH Key
const sshKeyType = ref<string>(props.initial?.sshKeyMetadata?.keyType ?? 'ed25519');
const sshPassphraseProtected = ref<boolean>(
	props.initial?.sshKeyMetadata?.passphraseProtected ?? true,
);
const sshPublicKey = ref(props.initial?.sshKeyMetadata?.publicKey ?? '');
const sshFingerprint = ref(props.initial?.sshKeyMetadata?.fingerprint ?? '');

// OAuth2
const oauthClientId = ref(props.initial?.oauth2Metadata?.clientId ?? '');
const oauthTokenUrl = ref(props.initial?.oauth2Metadata?.tokenUrl ?? '');
const oauthAuthUrl = ref(props.initial?.oauth2Metadata?.authUrl ?? '');
const oauthGrantType = ref<string>(
	props.initial?.oauth2Metadata?.grantType ?? 'client_credentials',
);
const oauthScopes = ref(props.initial?.oauth2Metadata?.scopes?.join(', ') ?? '');
const oauthExpiresAt = ref(props.initial?.oauth2Metadata?.expiresAt ?? '');

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
		const scopesArr = apiKeyScopes.value
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);

		const apiMeta: ApiKeyMetadata = {
			provider: apiKeyProvider.value.trim() || undefined,
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
		const scopesArr = oauthScopes.value
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);

		const oauthMeta: OAuth2Metadata = {
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
    <!-- Kind selector (only when creating) -->
    <div v-if="!isEdit && availableKinds.length > 1">
      <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
        Credential Type
      </label>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        <button
          v-for="k in availableKinds"
          :key="k.value"
          type="button"
          @click="kind = k.value"
          class="flex items-center gap-2 px-3 py-2 text-[12px] font-medium rounded-md border transition-all text-left"
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

    <!-- Title -->
    <div>
      <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
        Title *
      </label>
      <input
        v-model="title"
        type="text"
        :placeholder="
          kind === 'password'
            ? 'e.g. GitHub Enterprise'
            : kind === 'api-key'
            ? 'e.g. Stripe Production'
            : kind === 'ssh-key'
            ? 'e.g. Production Bastion Host'
            : kind === 'oauth2'
            ? 'e.g. Google Cloud App Client'
            : kind === 'secure-note'
            ? 'e.g. Disaster Recovery Runbook'
            : 'e.g. AWS IAM Deployment Role'
        "
        :class="controlBaseClass"
        class="px-3 py-2 text-[13px]"
        :style="inputStyle('title')"
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
          Password *
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
            placeholder="e.g. Stripe, OpenAI"
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
          <AppSelect
            v-model="apiKeyEnv"
            class="w-full"
            :options="ENV_OPTIONS"
            size="md"
          />
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
          <AppDateInput
            v-model="apiKeyExpiresAt"
            size="md"
          />
        </div>
      </div>

      <div>
        <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
          Scopes (comma-separated)
        </label>
        <input
          v-model="apiKeyScopes"
          type="text"
          placeholder="charges.create, customers.read"
          :class="controlBaseClass"
          class="px-3 py-2 text-[12px]"
          :style="inputStyle('apiKeyScopes')"
          @focus="focusedField = 'apiKeyScopes'"
          @blur="focusedField = null"
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
            placeholder="e.g. AWS, Cloudflare"
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
          Access Token *
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
          <AppSelect
            v-model="apiKeyEnv"
            class="w-full"
            :options="ENV_OPTIONS"
            size="md"
          />
        </div>
        <div>
          <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
            Expires At
          </label>
          <AppDateInput
            v-model="apiKeyExpiresAt"
            size="md"
          />
        </div>
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
          <AppSelect
            v-model="sshKeyType"
            class="w-full"
            :options="SSH_KEY_TYPE_OPTIONS"
            size="md"
          />
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
          <AppSelect
            v-model="oauthGrantType"
            class="w-full"
            :options="OAUTH_GRANT_TYPE_OPTIONS"
            size="md"
          />
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

      <div>
        <label class="text-[10px] font-semibold tracking-wider uppercase mb-1.5 block text-[var(--text-tertiary)]">
          Scopes (comma-separated)
        </label>
        <input
          v-model="oauthScopes"
          type="text"
          placeholder="openid, profile, read:data"
          :class="controlBaseClass"
          class="px-3 py-2 text-[12px]"
          :style="inputStyle('oauthScopes')"
          @focus="focusedField = 'oauthScopes'"
          @blur="focusedField = null"
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
          <AppSelect
            v-model="noteFormat"
            class="w-full"
            :options="NOTE_FORMAT_OPTIONS"
            size="md"
          />
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
        <AppSelect
          v-model="category"
          class="w-full"
          :options="CATEGORY_OPTIONS"
          size="md"
        />
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

    <!-- Action Buttons -->
    <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
      <AppButton variant="secondary" size="sm" type="button" @click="emit('cancel')">
        Cancel
      </AppButton>
      <AppButton variant="gold" size="sm" type="submit">
        {{ isEdit ? 'Save Changes' : 'Create Credential' }}
      </AppButton>
    </div>
  </form>
</template>
