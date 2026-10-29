import { describe, expect, it } from 'vitest';

import {
	InitializeVaultRequestSchema,
	InitializeVaultResponseSchema,
	LockVaultResponseSchema,
	PASSPHRASE_MAX_LENGTH,
	UnlockVaultRequestSchema,
	UnlockVaultResponseSchema,
	VaultIdParamsSchema,
	VaultStatusResponseSchema,
} from '../index.js';

const VAULT_ID = '00000000-0000-4000-8000-000000000001';

describe('vault contracts', () => {
	it('accepts a minimal initialize request and an optional vault id', () => {
		expect(InitializeVaultRequestSchema.parse({ passphrase: 'correct horse' })).toEqual({
			passphrase: 'correct horse',
		});
		expect(
			InitializeVaultRequestSchema.parse({ passphrase: 'correct horse', vaultId: VAULT_ID }),
		).toEqual({ passphrase: 'correct horse', vaultId: VAULT_ID });
	});

	it('rejects missing, empty, and oversized passphrases without echoing them', () => {
		expect(() => InitializeVaultRequestSchema.parse({})).toThrow();
		expect(() => InitializeVaultRequestSchema.parse({ passphrase: '' })).toThrow();
		expect(() =>
			InitializeVaultRequestSchema.parse({ passphrase: 'x'.repeat(PASSPHRASE_MAX_LENGTH + 1) }),
		).toThrow();
	});

	it('rejects unknown keys and malformed vault ids', () => {
		expect(() => InitializeVaultRequestSchema.parse({ passphrase: 'pw', extra: 'nope' })).toThrow();
		expect(() =>
			InitializeVaultRequestSchema.parse({ passphrase: 'pw', vaultId: 'not-a-uuid' }),
		).toThrow();
	});

	it('validates unlock and lock requests/responses', () => {
		expect(UnlockVaultRequestSchema.parse({ passphrase: 'pw' })).toEqual({ passphrase: 'pw' });
		expect(() => UnlockVaultRequestSchema.parse({ passphrase: 'pw', vaultId: VAULT_ID })).toThrow();
		expect(UnlockVaultResponseSchema.parse({ vaultId: VAULT_ID, status: 'unlocked' })).toEqual({
			vaultId: VAULT_ID,
			status: 'unlocked',
		});
		expect(LockVaultResponseSchema.parse({ vaultId: VAULT_ID, status: 'locked' })).toEqual({
			vaultId: VAULT_ID,
			status: 'locked',
		});
	});

	it('validates status responses including the uninitialized form', () => {
		expect(VaultStatusResponseSchema.parse({ status: 'unlocked', vaultId: VAULT_ID })).toEqual({
			status: 'unlocked',
			vaultId: VAULT_ID,
		});
		expect(VaultStatusResponseSchema.parse({ status: 'uninitialized', vaultId: null })).toEqual({
			status: 'uninitialized',
			vaultId: null,
		});
		expect(() =>
			VaultStatusResponseSchema.parse({ status: 'uninitialized', vaultId: VAULT_ID }),
		).not.toThrow();
		expect(() => VaultStatusResponseSchema.parse({ status: 'unknown', vaultId: null })).toThrow();
	});

	it('validates vault path parameters strictly', () => {
		expect(VaultIdParamsSchema.parse({ vaultId: VAULT_ID })).toEqual({ vaultId: VAULT_ID });
		expect(() => VaultIdParamsSchema.parse({ vaultId: VAULT_ID, extra: 'x' })).toThrow();
		expect(() => VaultIdParamsSchema.parse({ vaultId: 'nope' })).toThrow();
	});

	it('validates initialization responses', () => {
		expect(InitializeVaultResponseSchema.parse({ vaultId: VAULT_ID, status: 'locked' })).toEqual({
			vaultId: VAULT_ID,
			status: 'locked',
		});
		expect(() =>
			InitializeVaultResponseSchema.parse({ vaultId: VAULT_ID, status: 'uninitialized' }),
		).toThrow();
	});
});
