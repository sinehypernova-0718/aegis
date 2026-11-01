/**
 * HTTP-backed VaultClient — the real adapter.
 *
 * Talks to the local Aegis Fastify server exclusively through the
 * `SessionClient`, so:
 *  - every request is same-origin with `credentials: 'same-origin'`;
 *  - the auth credential is the `HttpOnly` `aegis_session` cookie installed by
 *    `POST /auth/session` — the per-launch token is never read from JS;
 *  - a `401 UNAUTHENTICATED` response transparently re-establishes the session
 *    (once) and retries the request.
 *
 * Wire-shape notes (see `packages/contracts` and `apps/server/src/http`):
 *  - all routes are vault-scoped; this app is single-vault, so the client
 *    carries a stable local vault id and supplies it on vault creation,
 *    keeping the vault's identity stable across browser restarts;
 *  - credential payloads travel wrapped in `{ payload: ... }` (strict zod
 *    schemas reject unknown top-level keys);
 *  - the backend's `CredentialKind` values are snake_case while the UI model
 *    uses kebab-case; `toUiKind`/`toApiKind` translate the two directions;
 *  - `PUT` credential updates are a full replacement, so an update is folded
 *    onto a freshly fetched detail before it is sent.
 */

import { SessionClient } from '@/auth/session';
import type {
	CredentialKind,
	CredentialSummary,
	CredentialDetail,
	CreateCredentialInput,
	UpdateCredentialInput,
	VaultStatus,
	ActivityEvent,
} from '@/types';
import type { VaultClient, CreateVaultResult, RecoverVaultResult } from './contracts';

/**
 * Stable identity for the local vault. Supplied on vault creation so the
 * server does not invent a per-run id the browser could not rediscover after a
 * reload; every subsequent status/unlock/lock/credential call uses the same id.
 */
const DEFAULT_VAULT_ID = 'b3f0c9a1-7e2d-4b68-95cf-1a4d6e8b0c25';

const SERVER_PASSPHRASE_MAX_LENGTH = 1_024;

/** Backend kind (snake_case, `packages/contracts/credentials/credential-kind.ts`). */
type ApiCredentialKind = string;

interface ApiCredentialSummary {
	id: string;
	createdAt: string;
	updatedAt: string;
	type: ApiCredentialKind;
	name: string;
	username?: string;
	url?: string;
	tags: string[];
	expiresAt?: string;
}

interface ApiCredentialPayload {
	type: ApiCredentialKind;
	name: string;
	secret: string;
	username?: string;
	url?: string;
	notes?: string;
	tags: string[];
	expiresAt?: string;
}

interface ApiCredentialDetail {
	id: string;
	createdAt: string;
	updatedAt: string;
	payload: ApiCredentialPayload;
}

/** Error body from `apps/server/src/http/error-handler.ts`. */
interface ApiErrorBody {
	code?: string;
	message?: string;
	requestId?: string;
}

/** Modeled after the server error codes (`packages/contracts/errors/codes.ts`). */
export class VaultApiError extends Error {
	readonly status: number;
	readonly code: string | null;
	/** Seconds to wait before retrying after a `RATE_LIMITED` unlock failure. */
	readonly retryAfterSeconds: number | null;

	constructor(
		message: string,
		options: { status: number; code?: string | null; retryAfterSeconds?: number | null } = {
			status: 0,
		},
	) {
		super(message);
		this.name = 'VaultApiError';
		this.status = options.status;
		this.code = options.code ?? null;
		this.retryAfterSeconds = options.retryAfterSeconds ?? null;
	}
}

// ---------------------------------------------------------------------------
// Kind translation (backend snake_case ⇄ UI kebab-case)
// ---------------------------------------------------------------------------

const API_KIND_TO_UI: Record<string, CredentialKind> = {
	password: 'password',
	api_key: 'api-key',
	access_token: 'access-token',
	refresh_token: 'access-token',
	ssh_key: 'ssh-key',
	secure_note: 'secure-note',
	// UI-only kinds with no dedicated backend counterpart yet: keep the
	// credential visible under the closest existing page instead of dropping it.
	certificate: 'secure-note',
	recovery_code: 'secure-note',
};

function toUiKind(value: ApiCredentialKind): CredentialKind {
	return API_KIND_TO_UI[value] ?? 'secure-note'; // unknown/forward-compat kinds stay visible
}

const UI_KIND_TO_API: Record<CredentialKind, ApiCredentialKind> = {
	password: 'password',
	'api-key': 'api_key',
	'access-token': 'access_token',
	oauth2: 'access_token', // OAuth2 storage model maps onto token payloads for now
	'ssh-key': 'ssh_key',
	'secure-note': 'secure_note',
};

// ---------------------------------------------------------------------------
// Translation helpers
// ---------------------------------------------------------------------------

/**
 * Strip exact-optional properties instead of sending explicit `undefined`
 * values, so request bodies contain only present fields.
 */
function omitUndefined<T extends object>(input: T): T {
	const copy: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(input)) {
		if (value !== undefined) copy[key] = value;
	}
	return copy as T;
}

function toUiSummary(api: ApiCredentialSummary, vaultId: string): CredentialSummary {
	return omitUndefined({
		id: api.id,
		vaultId,
		kind: toUiKind(api.type),
		title: api.name,
		username: api.username,
		url: api.url,
		tags: [...api.tags],
		createdAt: api.createdAt,
		updatedAt: api.updatedAt,
	});
}

function toUiDetail(api: ApiCredentialDetail, vaultId: string): CredentialDetail {
	return omitUndefined({
		id: api.id,
		vaultId,
		kind: toUiKind(api.payload.type),
		title: api.payload.name,
		username: api.payload.username,
		url: api.payload.url,
		tags: [...api.payload.tags],
		createdAt: api.createdAt,
		updatedAt: api.updatedAt,
		secret: api.payload.secret,
		notes: api.payload.notes,
	});
}

interface UiPayloadFields {
	name: string;
	secret: string;
	username?: string | undefined;
	url?: string | undefined;
	notes?: string | undefined;
	tags?: string[] | undefined;
	expiresAt?: string | undefined;
}

function toApiPayload(api: ApiCredentialKind, payload: UiPayloadFields): { payload: object } {
	return {
		payload: omitUndefined({
			type: api,
			name: payload.name,
			secret: payload.secret,
			username: payload.username,
			url: payload.url,
			notes: payload.notes,
			tags: payload.tags ?? [],
			expiresAt: payload.expiresAt,
		}),
	};
}

// ---------------------------------------------------------------------------
// The client
// ---------------------------------------------------------------------------

interface ApiVaultStatus {
	status: 'uninitialized' | 'locked' | 'unlocked';
	vaultId: string | null;
}

interface ApiListCredentialsResult {
	items: ApiCredentialSummary[];
	nextCursor: string | null;
}

export class HttpVaultClient implements VaultClient {
	readonly #session: SessionClient;
	readonly #vaultId: string;

	/** Last state reported or set by this client (for the sync `isUnlocked()`). */
	#state: 'uninitialized' | 'locked' | 'unlocked' | null = null;

	/** Deduplicated session-handoff promise; cleared when establishment fails. */
	#sessionReady: Promise<void> | null = null;

	constructor(options: { session: SessionClient; vaultId?: string }) {
		this.#session = options.session;
		this.#vaultId = options.vaultId ?? DEFAULT_VAULT_ID;
	}

	// -- transport -----------------------------------------------------------

	/**
	 * Session handoff lifecycle. The browser cannot read the per-launch token
	 * file; it must ask the trusted local server to install the `HttpOnly`
	 * session cookie (`POST /auth/session`) before any vault route will accept
	 * the request. The handoff runs:
	 *  - lazily, before this client's first request (i.e. during App startup's
	 *    first vault status query via `init()`);
	 *  - only when `hasSession()` reports the cookie is missing, avoiding a
	 *    second handoff POST on every reload;
	 *  - again, transparently, after any `401` (once per request).
	 */
	async #ensureSession(): Promise<void> {
		if (this.#sessionReady === null) {
			this.#sessionReady = (async () => {
				if (await this.#session.hasSession()) return;
				await this.#session.establish();
			})();
			this.#sessionReady.catch(() => {
				this.#sessionReady = null; // allow a retry on the next request
			});
		}
		return this.#sessionReady;
	}

	async #request(path: string, init: RequestInit, retryOn401 = true): Promise<Response> {
		try {
			await this.#ensureSession();
		} catch {
			throw new VaultApiError(
				'Could not establish a local session with the Aegis backend. Is the server running?',
				{ status: 0, code: 'UNAUTHENTICATED', retryAfterSeconds: null },
			);
		}
		const response = await this.#session.request(path, init);
		if (response.status === 401 && retryOn401) {
			// The HttpOnly cookie is missing or stale: ask the trusted local
			// server to re-install it, then replay the request exactly once.
			try {
				this.#sessionReady = null;
				await this.#session.establish();
			} catch {
				throw new VaultApiError(
					'Could not establish a local session with the Aegis backend. Is the server running?',
					{ status: 0, code: 'UNAUTHENTICATED', retryAfterSeconds: null },
				);
			}
			return this.#request(path, init, false);
		}
		return response;
	}

	async #json<T>(response: Response): Promise<T> {
		if (!response.ok) throw await this.#errorFrom(response);
		try {
			return (await response.json()) as T;
		} catch {
			throw new VaultApiError('The Aegis backend returned a malformed response.', {
				status: response.status,
				code: null,
				retryAfterSeconds: null,
			});
		}
	}

	async #errorFrom(response: Response): Promise<VaultApiError> {
		let body: ApiErrorBody | null = null;
		try {
			body = (await response.json()) as ApiErrorBody;
		} catch {
			body = null;
		}

		let message = body?.message;
		if (typeof message !== 'string' || message.length === 0) {
			message = `Request failed (HTTP ${response.status}).`;
		}
		if (body?.code === 'VAULT_LOCKED') {
			message = 'Vault is locked. Unlock it first.';
		}
		if (body?.code === 'UNAUTHENTICATED' && response.status === 401) {
			// Reached after a re-establish attempt: the handshake itself failed.
			message = 'Local authentication failed. Please restart the Aegis backend.';
		}

		const retryAfterHeader = response.headers.get('retry-after');
		const retryAfterSeconds =
			retryAfterHeader !== null && Number.isFinite(Number(retryAfterHeader))
				? Math.max(0, Math.ceil(Number(retryAfterHeader)))
				: null;

		return new VaultApiError(message, {
			status: response.status,
			code: body?.code ?? null,
			retryAfterSeconds,
		});
	}

	#throwIfNetworkError(cause: unknown): never {
		if (cause instanceof VaultApiError) throw cause;
		throw new VaultApiError(
			'Could not reach the Aegis backend. Please verify that the backend is running.',
			{ status: 0, code: null, retryAfterSeconds: null },
		);
	}

	// -- vault lifecycle -----------------------------------------------------

	async getVaultStatus(): Promise<VaultStatus> {
		try {
			const response = await this.#request(`/vaults/${this.#vaultId}/status`, { method: 'GET' });
			const api = await this.#json<ApiVaultStatus>(response);
			this.#state = api.status;
			return omitUndefined({
				state: api.status,
				vaultId: api.vaultId === null ? undefined : api.vaultId,
			});
		} catch (cause) {
			this.#throwIfNetworkError(cause);
		}
	}

	async unlockVault(passphrase: string): Promise<{ success: boolean; error?: string }> {
		if (typeof passphrase !== 'string' || passphrase.length === 0) {
			return { success: false, error: 'Passphrase is required.' };
		}
		if (passphrase.length > SERVER_PASSPHRASE_MAX_LENGTH) {
			return { success: false, error: 'Passphrase is too long.' };
		}
		try {
			const response = await this.#request(`/vaults/${this.#vaultId}/unlock`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ passphrase }),
			});
			const result = await this.#json<{ status: 'unlocked' }>(response);
			this.#state = result.status;
			return { success: true };
		} catch (cause) {
			if (cause instanceof VaultApiError) {
				if (cause.code === 'UNAUTHENTICATED') {
					return { success: false, error: 'Incorrect master passphrase. Please try again.' };
				}
				if (cause.code === 'RATE_LIMITED') {
					return {
						success: false,
						error:
							cause.retryAfterSeconds !== null
								? `Too many failed attempts. Try again in ${cause.retryAfterSeconds}s.`
								: 'Too many failed attempts. Try again in a minute.',
					};
				}
				return { success: false, error: cause.message };
			}
			this.#throwIfNetworkError(cause);
		}
	}

	async createVault(passphrase: string, confirmPassphrase: string): Promise<CreateVaultResult> {
		// UX policy mirrored from the mock (the backend only requires a
		// non-empty passphrase): a matching 12+ char passphrase.
		if (typeof passphrase !== 'string' || passphrase.length < 12) {
			return { success: false, error: 'Passphrase must be at least 12 characters.' };
		}
		if (passphrase !== confirmPassphrase) {
			return { success: false, error: 'Passphrases do not match.' };
		}
		if (passphrase.length > SERVER_PASSPHRASE_MAX_LENGTH) {
			return { success: false, error: 'Passphrase is too long.' };
		}
		try {
			const response = await this.#request('/vaults', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ passphrase, vaultId: this.#vaultId }),
			});
			const result = await this.#json<{ vaultId: string; status: 'unlocked' | 'locked' }>(
				response,
			);
			this.#state = result.status;
			// The backend issues no recovery key on creation; the interface
			// documents that `recoveryKey` is omitted in that case and the
			// store completes setup directly.
			return { success: true };
		} catch (cause) {
			if (cause instanceof VaultApiError) {
				return { success: false, error: cause.message };
			}
			this.#throwIfNetworkError(cause);
		}
	}

	async recoverVault(_recoveryKey: string): Promise<RecoverVaultResult> {
		// Keep the explicit "not supported" seam: the backend has no recovery
		// endpoint yet, and the store surfaces a precise message for it.
		return {
			success: false,
			error: 'Emergency recovery is not supported by the active backend.',
		};
	}

	async lockVault(): Promise<void> {
		try {
			// Locking is parameterless upstream, so send no body/content-type.
			const response = await this.#request(`/vaults/${this.#vaultId}/lock`, { method: 'POST' });
			const result = await this.#json<{ status: 'locked' }>(response);
			this.#state = result.status;
		} catch (cause) {
			this.#throwIfNetworkError(cause);
		}
	}

	// -- credentials ---------------------------------------------------------

	/**
	 * Page through the backend list endpoint (`limit` ≤ 100, cursor opaque)
	 * until exhausted, then apply the UI filter client-side: the backend only
	 * supports cursor paging today, not kind filters.
	 */
	async listCredentials(filter?: {
		kind?: CredentialKind;
		category?: string;
	}): Promise<CredentialSummary[]> {
		try {
			const all: CredentialSummary[] = [];
			let cursor: string | undefined;
			do {
				const search = new URLSearchParams({ limit: '100' });
				if (cursor !== undefined) search.set('cursor', cursor);
				const response = await this.#request(
					`/vaults/${this.#vaultId}/credentials?${search.toString()}`,
					{ method: 'GET' },
				);
				const page = await this.#json<ApiListCredentialsResult>(response);
				for (const item of page.items) all.push(toUiSummary(item, this.#vaultId));
				cursor = page.nextCursor ?? undefined;
			} while (cursor !== undefined);

			return all.filter((c) => {
				if (filter?.kind && c.kind !== filter.kind) return false;
				if (filter?.category && filter.category !== 'All' && c.category !== filter.category) {
					return false;
				}
				return true;
			});
		} catch (cause) {
			this.#throwIfNetworkError(cause);
		}
	}

	async listPasswords(): Promise<CredentialSummary[]> {
		return this.listCredentials({ kind: 'password' });
	}

	async listApiKeys(): Promise<CredentialSummary[]> {
		const all = await this.listCredentials();
		return all.filter((c) => c.kind === 'api-key' || c.kind === 'access-token');
	}

	async listOAuth2Credentials(): Promise<CredentialSummary[]> {
		return this.listCredentials({ kind: 'oauth2' });
	}

	async listSecureNotes(): Promise<CredentialSummary[]> {
		return this.listCredentials({ kind: 'secure-note' });
	}

	async getCredential(id: string): Promise<CredentialDetail> {
		try {
			const response = await this.#request(
				`/vaults/${this.#vaultId}/credentials/${encodeURIComponent(id)}`,
				{ method: 'GET' },
			);
			const api = await this.#json<ApiCredentialDetail>(response);
			return toUiDetail(api, this.#vaultId);
		} catch (cause) {
			this.#throwIfNetworkError(cause);
		}
	}

	/**
	 * PUT is a full payload replacement upstream. Fold the (partial) UI input
	 * onto the current detail before sending so untouched fields survive.
	 */
	async updateCredential(id: string, input: UpdateCredentialInput): Promise<CredentialSummary> {
		try {
			const current = await this.getCredential(id);
			const merged: UiPayloadFields = omitUndefined({
				name: input.title ?? current.title,
				secret: input.secret ?? current.secret,
				username: input.username !== undefined ? input.username : current.username,
				url: input.url !== undefined ? input.url : current.url,
				notes: input.notes !== undefined ? input.notes : current.notes,
				tags: input.tags !== undefined ? [...input.tags] : current.tags,
			});
			const response = await this.#request(
				`/vaults/${this.#vaultId}/credentials/${encodeURIComponent(id)}`,
				{
					method: 'PUT',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(toApiPayload(UI_KIND_TO_API[current.kind], merged)),
				},
			);
			const result = await this.#json<{ id: string; updatedAt: string }>(response);
			return omitUndefined({ ...current, updatedAt: result.updatedAt });
		} catch (cause) {
			this.#throwIfNetworkError(cause);
		}
	}

	async createCredential(input: CreateCredentialInput): Promise<CredentialSummary> {
		try {
			// API-key expiry rides along with the payload as the backend's `expiresAt`.
			const expiresAt = input.apiKeyMetadata?.expiresAt ?? input.metadata?.expiresAt;
			const response = await this.#request(`/vaults/${this.#vaultId}/credentials`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(
					toApiPayload(UI_KIND_TO_API[input.kind], {
						name: input.title,
						secret: input.secret,
						username: input.username,
						url: input.url,
						notes: input.notes,
						tags: input.tags,
						expiresAt,
					}),
				),
			});
			const api = await this.#json<ApiCredentialSummary>(response);
			return toUiSummary(api, this.#vaultId);
		} catch (cause) {
			this.#throwIfNetworkError(cause);
		}
	}

	async deleteCredential(id: string): Promise<void> {
		try {
			const response = await this.#request(
				`/vaults/${this.#vaultId}/credentials/${encodeURIComponent(id)}`,
				{ method: 'DELETE' },
			);
			await this.#json<{ id: string; deleted: boolean }>(response);
		} catch (cause) {
			this.#throwIfNetworkError(cause);
		}
	}

	// -- activity ------------------------------------------------------------

	/**
	 * The backend has no activity feed yet (`ActivityEvent` has no HTTP
	 * counterpart). Return the empty baseline so the UI treats it as "no
	 * activity recorded server-side" instead of surfacing a connection error.
	 */
	async getActivity(): Promise<ActivityEvent[]> {
		return [];
	}

	isUnlocked(): boolean {
		return this.#state === 'unlocked';
	}
}
