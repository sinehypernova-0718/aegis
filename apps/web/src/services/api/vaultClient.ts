/**
 * Vault client — the active service boundary.
 *
 * The real HTTP adapter (`HttpVaultClient`) is the default in every mode. The
 * mock adapter is kept strictly for UI/screenshot development that must not
 * touch the backend, and requires an explicit opt-in via
 * `VITE_AEGIS_USE_MOCK_API` in dev builds — the flag is unreadable in prod, so
 * the mock can never silently become the production vault implementation.
 */

import type { VaultClient } from './contracts';
import { HttpVaultClient } from './httpVaultClient';
import { SessionClient } from '@/auth/session';
import { mockVaultClient } from '@/services/mock/mockVaultClient';

/** Same-origin session client used by both the real client and the UI startup. */
export const sessionClient = new SessionClient();

/**
 * Read `import.meta.env` defensively (Node/tsx test environments may not
 * define it). Signed off at runtime: `VITE_AEGIS_USE_MOCK_API=1` in dev.
 */
function envFlags(): { dev: boolean; useMock: boolean } {
	const env = (import.meta as {
		env?: { DEV?: boolean; VITE_AEGIS_USE_MOCK_API?: string };
	}).env;
	const dev = env?.DEV === true;
	const useMock = dev && env?.VITE_AEGIS_USE_MOCK_API === '1';
	return { dev, useMock };
}

function resolveVaultClient(): VaultClient {
	const { dev, useMock } = envFlags();
	// The mock only ever activates on the explicit dev opt-in; in prod the
	// flag path is unreachable.
	if (dev && useMock) {
		// eslint-disable-next-line no-console
		console.warn(
			'[aegis] Using the MOCK vault client (VITE_AEGIS_USE_MOCK_API=1). ' +
				'Never ship this mode: it talks to synthetic data, not the backend.',
		);
		return mockVaultClient;
	}
	return new HttpVaultClient({ session: sessionClient });
}

/**
 * The active vault client implementation. `HttpVaultClient` performs the
 * session handoff lazily on its first request, so every client call (and
 * therefore every store operation, including App startup's `init()`) begins
 * with a valid HttpOnly session cookie.
 */
export const vaultClient: VaultClient = resolveVaultClient();
