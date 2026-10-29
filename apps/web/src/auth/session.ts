/**
 * Trusted-UI side of the local authentication handoff.
 *
 * The browser cannot read the per-launch token file, and this module never asks
 * for the token. It calls the local server's same-origin `POST /auth/session`
 * endpoint, which installs the token as an `HttpOnly`, `SameSite=Strict`
 * cookie. From then on the browser attaches the credential automatically to
 * same-origin requests.
 *
 * Consequences:
 *  - the token never enters a URL, `localStorage`, or a log;
 *  - page JavaScript (including injected scripts) cannot read the cookie, so it
 *    cannot exfiltrate the long-lived token;
 *  - `credentials: 'same-origin'` keeps the credential off every cross-origin
 *    request, so a mixed-in third-party resource cannot receive it.
 */

const SESSION_PATH = '/auth/session';

/**
 * Must match `HANDOFF_HEADER` in `apps/server/src/http/routes/session.ts`.
 * Not a secret: it makes the handoff a non-simple request so a cross-site form
 * cannot trigger cookie issuance.
 */
const HANDOFF_HEADER = 'x-aegis-handoff';

export class SessionHandoffError extends Error {
	/** HTTP status, or 0 when the network request itself failed. */
	readonly status: number;

	constructor(message: string, status: number, options?: { cause?: unknown }) {
		super(message);
		this.name = 'SessionHandoffError';
		this.status = status;
		if (options?.cause !== undefined) this.cause = options.cause;
	}
}

export interface SessionClientOptions {
	/**
	 * API base URL. Leave empty for the normal same-origin deployment (Aegis
	 * serves the UI and API from the same loopback origin).
	 */
	readonly baseUrl?: string;
	/** Test seam. Defaults to `globalThis.fetch`. */
	readonly fetch?: typeof fetch;
}

function normalizeBaseUrl(baseUrl: string | undefined): string {
	const trimmed = (baseUrl ?? '').trim();
	if (trimmed === '') return '';
	return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

export class SessionClient {
	readonly #baseUrl: string;
	readonly #fetch: typeof fetch;

	constructor(options: SessionClientOptions = {}) {
		this.#baseUrl = normalizeBaseUrl(options.baseUrl);
		this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
	}

	#url(path: string): string {
		return `${this.#baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
	}

	async #send(path: string, init: RequestInit): Promise<Response> {
		try {
			// `same-origin` is deliberate: the HttpOnly credential must never be
			// attached to a cross-origin request.
			return await this.#fetch(this.#url(path), { ...init, credentials: 'same-origin' });
		} catch (cause) {
			throw new SessionHandoffError('local server is unreachable', 0, { cause });
		}
	}

	/** Ask the trusted local server to install the HttpOnly session cookie. */
	async establish(): Promise<void> {
		const response = await this.#send(SESSION_PATH, {
			method: 'POST',
			headers: { [HANDOFF_HEADER]: '1' },
		});
		if (response.status !== 204) {
			throw new SessionHandoffError('could not establish a local session', response.status);
		}
	}

	/** True when the browser already holds a valid session cookie. */
	async hasSession(): Promise<boolean> {
		const response = await this.#send(SESSION_PATH, { method: 'GET' });
		if (response.status === 204) return true;
		if (response.status === 401) return false;
		throw new SessionHandoffError('could not check the local session', response.status);
	}

	/** Ask the server to expire the cookie (local sign-out). */
	async clear(): Promise<void> {
		const response = await this.#send(SESSION_PATH, { method: 'DELETE' });
		if (response.status !== 204) {
			throw new SessionHandoffError('could not clear the local session', response.status);
		}
	}

	/**
	 * Authenticated same-origin request. The browser supplies the cookie; this
	 * method never reads or sets an `Authorization` header.
	 */
	async request(path: string, init: RequestInit = {}): Promise<Response> {
		return this.#send(path, init);
	}
}
