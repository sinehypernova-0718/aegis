import { z } from 'zod';

import { EntityIdSchema } from '../common/ids.js';
import { strictObject } from '../common/conventions.js';

/**
 * Passphrase bounds for the HTTP boundary. The domain only requires a
 * non-empty string; the upper bound here is a transport-level safety limit so a
 * hostile request cannot force unbounded Argon2id input handling.
 */
export const PASSPHRASE_MIN_LENGTH = 1 as const;
export const PASSPHRASE_MAX_LENGTH = 1_024 as const;

/** A passphrase is a required, non-empty string. It is never echoed back. */
export const PassphraseSchema: z.ZodType<string, string> = z
	.string()
	.min(PASSPHRASE_MIN_LENGTH)
	.max(PASSPHRASE_MAX_LENGTH);

export const InitializeVaultRequestSchema: z.ZodType<
	{ passphrase: string; vaultId?: string | undefined },
	{ passphrase: string; vaultId?: string | undefined }
> = strictObject({
	passphrase: PassphraseSchema,
	vaultId: EntityIdSchema.optional(),
});

export type InitializeVaultRequest = z.output<typeof InitializeVaultRequestSchema>;
export type InitializeVaultRequestInput = z.input<typeof InitializeVaultRequestSchema>;

/** Runtime state after initialization: an unlocked session may exist, or not. */
export const VaultRuntimeStateSchema: z.ZodType<'unlocked' | 'locked', 'unlocked' | 'locked'> =
	z.enum(['unlocked', 'locked']);

export const InitializeVaultResponseSchema: z.ZodType<
	{ vaultId: string; status: 'unlocked' | 'locked' },
	{ vaultId: string; status: 'unlocked' | 'locked' }
> = strictObject({
	vaultId: EntityIdSchema,
	status: VaultRuntimeStateSchema,
});

export type InitializeVaultResponse = z.output<typeof InitializeVaultResponseSchema>;
