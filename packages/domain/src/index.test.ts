import { describe, expect, it } from 'vitest';

import * as domain from './index.js';

describe('@aegis/domain', () => {
	it('loads the package entry point', () => {
		expect(domain.packageName).toBe('@aegis/domain');
	});

	it('exposes the intended public surface', () => {
		for (const name of [
			'InitializeVault',
			'UnlockVault',
			'LockVault',
			'GetVaultStatus',
			'CreateCredential',
			'GetCredential',
			'ListCredentials',
			'UpdateCredential',
			'DeleteCredential',
			'DefaultVaultSessionManager',
			'validateCredentialPayload',
			'serializeCredentialPayload',
			'parseCredentialPayload',
			'encodeCredentialCursor',
			'decodeCredentialCursor',
			'ENCRYPTED_RECORD_TYPE',
			'CREDENTIAL_KINDS',
			'DomainError',
			'VaultLockedError',
		]) {
			expect(domain, `missing public export: ${name}`).toHaveProperty(name);
		}
	});
});
