import { z } from 'zod';

import { EntityIdSchema } from '../common/ids.js';
import { strictObject } from '../common/conventions.js';
import { PassphraseSchema } from './initialize-vault.js';

export const UnlockVaultRequestSchema: z.ZodType<{ passphrase: string }, { passphrase: string }> =
	strictObject({
		passphrase: PassphraseSchema,
	});

export type UnlockVaultRequest = z.output<typeof UnlockVaultRequestSchema>;
export type UnlockVaultRequestInput = z.input<typeof UnlockVaultRequestSchema>;

export const UnlockVaultResponseSchema: z.ZodType<
	{ vaultId: string; status: 'unlocked' },
	{ vaultId: string; status: 'unlocked' }
> = strictObject({
	vaultId: EntityIdSchema,
	status: z.literal('unlocked'),
});

export type UnlockVaultResponse = z.output<typeof UnlockVaultResponseSchema>;
