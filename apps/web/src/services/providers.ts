// Provider catalog — the single source of truth for "which credential is this?".
//
// Logos are bundled offline as SVGs (src/assets/providers/*.svg) so the picker
// never touches the network. Sourced from each vendor's official brand assets
// via the Simple Icons (simpleicons.org) and gilbarbara/logos sets. Providers
// without a shipped mark fall back to a deterministic monogram avatar.

import type { CredentialKind } from '@/types';

export interface ProviderMark {
	/** Inline SVG markup, sized to fill its container. */
	html: string;
	/** Dark monochrome glyph that must follow the theme text color. */
	adaptive: boolean;
	/** Multicolor mark that should sit on a neutral plate for contrast. */
	plate: boolean;
}

const rawModules = import.meta.glob<string>('../assets/providers/*.svg', {
	eager: true,
	query: '?raw',
	import: 'default',
});

function extractColors(svg: string): string[] {
	const colors = new Set<string>();
	for (const match of svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)) {
		const value = match[1];
		if (!value || value === 'none' || value === 'currentColor' || value.startsWith('url(')) continue;
		colors.add(value.toLowerCase());
	}
	return [...colors];
}

function hexToRgb(color: string): { r: number; g: number; b: number } | null {
	const hex = color.replace('#', '');
	if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/.test(hex)) return null;
	const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
	return {
		r: Number.parseInt(full.slice(0, 2), 16),
		g: Number.parseInt(full.slice(2, 4), 16),
		b: Number.parseInt(full.slice(4, 6), 16),
	};
}

function isDarkColor(color: string): boolean {
	const rgb = hexToRgb(color);
	if (!rgb) return false;
	const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
	return luminance < 0.45;
}

function sizeToFill(svg: string): string {
	return svg
		.replace(/\s(?:width|height)="[^"]*"/g, '')
		.replace('<svg', '<svg width="100%" height="100%" preserveAspectRatio="xMidYMid meet"');
}

function toCurrentColor(svg: string): string {
	return svg.replace(/(fill|stroke)="(#[0-9a-fA-F]{3,8})"/g, '$1="currentColor"');
}

const MARKS: Record<string, ProviderMark> = {};
for (const [path, svg] of Object.entries(rawModules)) {
	const id = path.split('/').pop()?.replace(/\.svg$/, '');
	if (!id) continue;
	const colors = extractColors(svg);
	const monochrome = colors.length <= 1;
	const darkMonochrome = monochrome && (colors.length === 0 || isDarkColor(colors[0]!));
	if (darkMonochrome) {
		MARKS[id] = { html: sizeToFill(toCurrentColor(svg)), adaptive: true, plate: false };
	} else {
		MARKS[id] = { html: sizeToFill(svg), adaptive: false, plate: !monochrome };
	}
}

export function providerMark(id: string | undefined | null): ProviderMark | undefined {
	if (!id) return undefined;
	return MARKS[id];
}

export interface Provider {
	/** Stable id and logo filename (without extension). */
	readonly id: string;
	readonly name: string;
	/** Lowercase search aliases (handles "gh", "k8s", "postgres", ...). */
	readonly aliases: readonly string[];
	/** Which kind is pre-selected when this provider is chosen. */
	readonly defaultKind: CredentialKind;
	/** Kinds surfaced first (still only a sort hint — all six stay selectable). */
	readonly primaryKinds: readonly CredentialKind[];
	/** Suggested scope chips for the tag editor. */
	readonly scopes: readonly string[];
	/** Optional management URL pre-filled for the credential. */
	readonly url?: string;
}

export const OTHER_PROVIDER_ID = 'other';

export const PROVIDERS: readonly Provider[] = [
	{
		id: 'github',
		name: 'GitHub',
		aliases: ['gh', 'git', 'github'],
		defaultKind: 'access-token',
		primaryKinds: ['access-token', 'oauth2', 'ssh-key', 'password'],
		scopes: ['repo', 'read:org', 'workflow', 'admin:repo_hook', 'write:packages', 'read:user'],
		url: 'https://github.com/settings/tokens',
	},
	{
		id: 'google',
		name: 'Google',
		aliases: ['gmail', 'gcp', 'gworkspace'],
		defaultKind: 'oauth2',
		primaryKinds: ['oauth2', 'api-key', 'password'],
		scopes: ['openid', 'profile', 'email', 'drive.readonly', 'calendar'],
		url: 'https://console.cloud.google.com/apis/credentials',
	},
	{
		id: 'cloudflare',
		name: 'Cloudflare',
		aliases: ['cf'],
		defaultKind: 'api-key',
		primaryKinds: ['api-key', 'access-token'],
		scopes: ['Account:Read', 'Zone:Read', 'DNS:Edit', 'Workers:Edit'],
		url: 'https://dash.cloudflare.com/profile/api-tokens',
	},
	{
		id: 'amazonwebservices',
		name: 'AWS',
		aliases: ['amazon', 'aws', 'iam'],
		defaultKind: 'api-key',
		primaryKinds: ['api-key', 'access-token', 'ssh-key'],
		scopes: ['s3:*', 'iam:PassRole', 'ec2:*', 'lambda:*', 'dynamodb:*'],
		url: 'https://console.aws.amazon.com/iam',
	},
	{
		id: 'microsoftazure',
		name: 'Microsoft Azure',
		aliases: ['azure', 'microsoft', 'ms'],
		defaultKind: 'oauth2',
		primaryKinds: ['oauth2', 'api-key', 'password'],
		scopes: ['User.Read', 'Mail.Read', 'Files.ReadWrite', 'offline_access'],
		url: 'https://portal.azure.com',
	},
	{
		id: 'stripe',
		name: 'Stripe',
		aliases: ['payments', 'billing'],
		defaultKind: 'api-key',
		primaryKinds: ['api-key', 'access-token'],
		scopes: ['charges:read', 'charges:write', 'customers:read', 'webhooks:write'],
		url: 'https://dashboard.stripe.com/apikeys',
	},
	{
		id: 'openai',
		name: 'OpenAI',
		aliases: ['gpt', 'chatgpt', 'ai'],
		defaultKind: 'api-key',
		primaryKinds: ['api-key'],
		scopes: ['models:read', 'chat:write', 'embeddings:read', 'files:write'],
		url: 'https://platform.openai.com/api-keys',
	},
	{
		id: 'anthropic',
		name: 'Anthropic',
		aliases: ['claude', 'ai'],
		defaultKind: 'api-key',
		primaryKinds: ['api-key'],
		scopes: ['messages:read', 'messages:write'],
		url: 'https://console.anthropic.com/settings/keys',
	},
	{
		id: 'discord',
		name: 'Discord',
		aliases: ['chat', 'bot'],
		defaultKind: 'oauth2',
		primaryKinds: ['oauth2', 'access-token'],
		scopes: ['bot', 'identify', 'guilds', 'applications.commands'],
		url: 'https://discord.com/developers/applications',
	},
	{
		id: 'slack',
		name: 'Slack',
		aliases: ['chat', 'workspace'],
		defaultKind: 'oauth2',
		primaryKinds: ['oauth2', 'access-token'],
		scopes: ['channels:read', 'chat:write', 'users:read', 'files:write'],
		url: 'https://api.slack.com/apps',
	},
	{
		id: 'notion',
		name: 'Notion',
		aliases: ['docs', 'wiki'],
		defaultKind: 'access-token',
		primaryKinds: ['access-token', 'oauth2'],
		scopes: ['read_content', 'insert_content', 'update_content'],
		url: 'https://www.notion.so/my-integrations',
	},
	{
		id: 'vercel',
		name: 'Vercel',
		aliases: ['hosting', 'deploy'],
		defaultKind: 'access-token',
		primaryKinds: ['access-token', 'api-key'],
		scopes: ['deployments:read', 'projects:write', 'env:write'],
		url: 'https://vercel.com/account/tokens',
	},
	{
		id: 'netlify',
		name: 'Netlify',
		aliases: ['hosting', 'deploy'],
		defaultKind: 'access-token',
		primaryKinds: ['access-token', 'api-key'],
		scopes: ['sites:read', 'deploys:write'],
		url: 'https://app.netlify.com/user/applications',
	},
	{
		id: 'gitlab',
		name: 'GitLab',
		aliases: ['git', 'gl'],
		defaultKind: 'access-token',
		primaryKinds: ['access-token', 'ssh-key', 'oauth2'],
		scopes: ['api', 'read_repository', 'write_repository', 'read_user'],
		url: 'https://gitlab.com/-/user_settings/personal_access_tokens',
	},
	{
		id: 'bitbucket',
		name: 'Bitbucket',
		aliases: ['git', 'bb', 'atlassian'],
		defaultKind: 'access-token',
		primaryKinds: ['access-token', 'ssh-key'],
		scopes: ['account:read', 'repository:write', 'pullrequest:write'],
		url: 'https://bitbucket.org/account/settings/app-passwords/',
	},
	{
		id: 'digitalocean',
		name: 'DigitalOcean',
		aliases: ['do', 'droplet', 'hosting'],
		defaultKind: 'access-token',
		primaryKinds: ['access-token', 'api-key', 'ssh-key'],
		scopes: ['read', 'write'],
		url: 'https://cloud.digitalocean.com/account/api/tokens',
	},
	{
		id: 'heroku',
		name: 'Heroku',
		aliases: ['hosting', 'deploy'],
		defaultKind: 'api-key',
		primaryKinds: ['api-key', 'access-token'],
		scopes: ['global', 'read', 'write'],
		url: 'https://dashboard.heroku.com/account/applications',
	},
	{
		id: 'mongodb',
		name: 'MongoDB',
		aliases: ['mongo', 'db', 'atlas'],
		defaultKind: 'password',
		primaryKinds: ['password', 'api-key'],
		scopes: ['readWrite', 'dbAdmin', 'clusterMonitor'],
		url: 'https://cloud.mongodb.com',
	},
	{
		id: 'postgresql',
		name: 'PostgreSQL',
		aliases: ['postgres', 'pg', 'db'],
		defaultKind: 'password',
		primaryKinds: ['password'],
		scopes: [],
	},
	{
		id: 'mysql',
		name: 'MySQL',
		aliases: ['db', 'maria'],
		defaultKind: 'password',
		primaryKinds: ['password'],
		scopes: [],
	},
	{
		id: 'redis',
		name: 'Redis',
		aliases: ['cache', 'db'],
		defaultKind: 'password',
		primaryKinds: ['password'],
		scopes: [],
	},
	{
		id: 'docker',
		name: 'Docker',
		aliases: ['container', 'registry'],
		defaultKind: 'password',
		primaryKinds: ['password', 'access-token'],
		scopes: [],
		url: 'https://hub.docker.com/settings/security',
	},
	{
		id: 'kubernetes',
		name: 'Kubernetes',
		aliases: ['k8s', 'kube'],
		defaultKind: 'access-token',
		primaryKinds: ['access-token', 'secure-note'],
		scopes: ['get', 'list', 'watch', 'create', 'delete'],
	},
	{
		id: 'npm',
		name: 'npm',
		aliases: ['node', 'registry', 'package'],
		defaultKind: 'access-token',
		primaryKinds: ['access-token'],
		scopes: ['read-only', 'automation', 'publish'],
		url: 'https://www.npmjs.com/settings/~/tokens',
	},
	{
		id: 'twilio',
		name: 'Twilio',
		aliases: ['sms', 'telephony'],
		defaultKind: 'api-key',
		primaryKinds: ['api-key', 'access-token'],
		scopes: [],
		url: 'https://console.twilio.com',
	},
	{
		id: 'sendgrid',
		name: 'SendGrid',
		aliases: ['email', 'smtp'],
		defaultKind: 'api-key',
		primaryKinds: ['api-key'],
		scopes: ['mail.send', 'mail.read'],
		url: 'https://app.sendgrid.com/settings/api_keys',
	},
	{
		id: 'auth0',
		name: 'Auth0',
		aliases: ['auth', 'sso', 'identity'],
		defaultKind: 'oauth2',
		primaryKinds: ['oauth2', 'api-key'],
		scopes: ['openid', 'profile', 'email', 'offline_access'],
		url: 'https://manage.auth0.com',
	},
	{
		id: 'okta',
		name: 'Okta',
		aliases: ['auth', 'sso', 'identity'],
		defaultKind: 'oauth2',
		primaryKinds: ['oauth2', 'api-key'],
		scopes: ['openid', 'profile', 'email', 'groups'],
		url: 'https://developer.okta.com',
	},
	{
		id: 'firebase',
		name: 'Firebase',
		aliases: ['google', 'fb', 'realtime'],
		defaultKind: 'api-key',
		primaryKinds: ['api-key', 'oauth2'],
		scopes: ['read', 'write'],
		url: 'https://console.firebase.google.com',
	},
	{
		id: 'supabase',
		name: 'Supabase',
		aliases: ['db', 'postgres', 'backend'],
		defaultKind: 'api-key',
		primaryKinds: ['api-key', 'password'],
		scopes: ['anon', 'service_role'],
		url: 'https://supabase.com/dashboard/project/_/settings/api',
	},
	{
		id: 'grafana',
		name: 'Grafana',
		aliases: ['metrics', 'dashboard', 'observability'],
		defaultKind: 'access-token',
		primaryKinds: ['access-token', 'password'],
		scopes: ['datasources:read', 'dashboards:write'],
		url: 'https://grafana.com/profile/api-keys',
	},
	{
		id: 'datadog',
		name: 'Datadog',
		aliases: ['monitoring', 'observability'],
		defaultKind: 'api-key',
		primaryKinds: ['api-key', 'access-token'],
		scopes: ['metrics:read', 'logs:read', 'apm:read'],
		url: 'https://app.datadoghq.com/organization-settings/api-keys',
	},
	{
		id: 'shopify',
		name: 'Shopify',
		aliases: ['ecommerce', 'store'],
		defaultKind: 'access-token',
		primaryKinds: ['access-token', 'api-key', 'oauth2'],
		scopes: ['read_products', 'write_products', 'read_orders', 'write_orders'],
		url: 'https://partners.shopify.com',
	},
	{
		id: 'paypal',
		name: 'PayPal',
		aliases: ['payments'],
		defaultKind: 'oauth2',
		primaryKinds: ['oauth2', 'api-key'],
		scopes: ['openid', 'payments', 'transactions'],
		url: 'https://developer.paypal.com',
	},
	{
		id: 'telegram',
		name: 'Telegram',
		aliases: ['chat', 'bot', 'tg'],
		defaultKind: 'access-token',
		primaryKinds: ['access-token'],
		scopes: [],
		url: 'https://t.me/BotFather',
	},
	{
		id: 'x',
		name: 'X (Twitter)',
		aliases: ['twitter', 'tweet', 'social'],
		defaultKind: 'oauth2',
		primaryKinds: ['oauth2', 'access-token', 'api-key'],
		scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
		url: 'https://developer.x.com',
	},
	{
		id: 'facebook',
		name: 'Facebook',
		aliases: ['meta', 'social', 'fb'],
		defaultKind: 'oauth2',
		primaryKinds: ['oauth2', 'access-token'],
		scopes: ['public_profile', 'email', 'pages_manage_posts'],
		url: 'https://developers.facebook.com/apps',
	},
	{
		id: 'linkedin',
		name: 'LinkedIn',
		aliases: ['social', 'jobs'],
		defaultKind: 'oauth2',
		primaryKinds: ['oauth2', 'access-token'],
		scopes: ['openid', 'profile', 'email', 'w_member_social'],
		url: 'https://www.linkedin.com/developers/apps',
	},
	{
		id: 'zoom',
		name: 'Zoom',
		aliases: ['meetings', 'video'],
		defaultKind: 'oauth2',
		primaryKinds: ['oauth2', 'access-token'],
		scopes: ['meeting:read', 'meeting:write', 'user:read'],
		url: 'https://marketplace.zoom.us/develop/create',
	},
	{
		id: 'jira',
		name: 'Jira',
		aliases: ['atlassian', 'issues', 'tracker'],
		defaultKind: 'access-token',
		primaryKinds: ['access-token', 'oauth2'],
		scopes: ['read:jira-work', 'write:jira-work', 'manage:jira-configuration'],
		url: 'https://id.atlassian.com/manage-profile/security/api-tokens',
	},
	{
		id: 'trello',
		name: 'Trello',
		aliases: ['atlassian', 'kanban', 'boards'],
		defaultKind: 'api-key',
		primaryKinds: ['api-key', 'access-token'],
		scopes: ['read', 'write', 'account'],
		url: 'https://trello.com/power-ups/admin',
	},
	{
		id: 'salesforce',
		name: 'Salesforce',
		aliases: ['crm', 'sf'],
		defaultKind: 'oauth2',
		primaryKinds: ['oauth2', 'access-token'],
		scopes: ['api', 'refresh_token', 'offline_access'],
		url: 'https://login.salesforce.com',
	},
	{
		id: 'zapier',
		name: 'Zapier',
		aliases: ['automation', 'workflow'],
		defaultKind: 'api-key',
		primaryKinds: ['api-key', 'access-token'],
		scopes: [],
		url: 'https://zapier.com/app/settings/advanced',
	},
	{
		id: 'n8n',
		name: 'n8n',
		aliases: ['automation', 'workflow', 'self-hosted'],
		defaultKind: 'api-key',
		primaryKinds: ['api-key', 'access-token'],
		scopes: [],
		url: 'https://app.n8n.cloud',
	},
	{
		id: 'dropbox',
		name: 'Dropbox',
		aliases: ['storage', 'files'],
		defaultKind: 'access-token',
		primaryKinds: ['access-token', 'oauth2'],
		scopes: ['files.content.read', 'files.content.write', 'account_info.read'],
		url: 'https://www.dropbox.com/developers/apps',
	},
	{
		id: '1password',
		name: '1Password',
		aliases: ['password manager', 'op', 'onepassword'],
		defaultKind: 'api-key',
		primaryKinds: ['api-key', 'password'],
		scopes: [],
		url: 'https://my.1password.com',
	},
	{
		id: 'bitwarden',
		name: 'Bitwarden',
		aliases: ['password manager', 'bw'],
		defaultKind: 'api-key',
		primaryKinds: ['api-key', 'password'],
		scopes: [],
		url: 'https://vault.bitwarden.com',
	},
	{
		id: 'asana',
		name: 'Asana',
		aliases: ['tasks', 'projects'],
		defaultKind: 'access-token',
		primaryKinds: ['access-token', 'oauth2'],
		scopes: ['tasks:read', 'tasks:write', 'projects:read'],
		url: 'https://app.asana.com/0/my-apps',
	},
	{
		id: 'linear',
		name: 'Linear',
		aliases: ['issues', 'tracker'],
		defaultKind: 'api-key',
		primaryKinds: ['api-key', 'oauth2'],
		scopes: ['read', 'write', 'issues:create'],
		url: 'https://linear.app/settings/api',
	},
	{
		id: 'figma',
		name: 'Figma',
		aliases: ['design', 'ui'],
		defaultKind: 'access-token',
		primaryKinds: ['access-token', 'oauth2'],
		scopes: ['file_read', 'file_write'],
		url: 'https://www.figma.com/developers/api',
	},
	{
		id: 'hashicorp',
		name: 'HashiCorp',
		aliases: ['vault', 'terraform', 'consul'],
		defaultKind: 'access-token',
		primaryKinds: ['access-token', 'api-key'],
		scopes: [],
		url: 'https://portal.cloud.hashicorp.com',
	},
	{
		id: 'sentry',
		name: 'Sentry',
		aliases: ['errors', 'monitoring'],
		defaultKind: 'access-token',
		primaryKinds: ['access-token', 'api-key'],
		scopes: ['project:read', 'project:write', 'event:read'],
		url: 'https://sentry.io/settings/account/api/auth-tokens/',
	},
	{
		id: 'circleci',
		name: 'CircleCI',
		aliases: ['ci', 'build'],
		defaultKind: 'access-token',
		primaryKinds: ['access-token', 'api-key'],
		scopes: [],
		url: 'https://app.circleci.com/settings/user/tokens',
	},
];

export const PROVIDERS_BY_ID: Record<string, Provider> = Object.fromEntries(
	PROVIDERS.map((p) => [p.id, p]),
);

/** Resolve a provider for an existing record (best-effort, case-insensitive). */
export function findProviderById(id: string | undefined | null): Provider | undefined {
	if (!id) return undefined;
	return PROVIDERS_BY_ID[id.toLowerCase()];
}

/** Fuzzy-match a provider from free text (title / provider field). */
export function matchProviderFromText(text: string | undefined | null): Provider | undefined {
	if (!text) return undefined;
	const needle = text.trim().toLowerCase();
	if (needle.length === 0) return undefined;
	for (const provider of PROVIDERS) {
		if (provider.name.toLowerCase() === needle || provider.id === needle) return provider;
		if (provider.aliases.some((a) => a === needle)) return provider;
	}
	for (const provider of PROVIDERS) {
		if (needle.includes(provider.name.toLowerCase())) return provider;
		if (provider.aliases.some((a) => needle.includes(a))) return provider;
	}
	return undefined;
}

/** Deterministic monogram fallback for "Other" / missing logos. */
export function providerMonogram(name: string): { initials: string; hue: number } {
	const trimmed = name.trim();
	const initials = trimmed
		.split(/\s+/)
		.slice(0, 2)
		.map((w) => w[0]?.toUpperCase() ?? '')
		.join('') || '?';
	let hash = 0;
	for (let i = 0; i < trimmed.length; i += 1) {
		hash = (hash * 31 + trimmed.charCodeAt(i)) % 360;
	}
	return { initials, hue: hash };
}
