import { z } from 'zod';

import { EntityIdSchema } from '../common/ids.js';
import { strictObject } from '../common/conventions.js';
import { RecoveryKeySchema } from './initialize-vault.js';

/**
 * Emergency recovery: unlock a locked vault with the recovery key issued at
 * creation. Verified against the vault's dedicated `recovery`-purpose key
 * envelope; wrong keys count against the same unlock throttle as passphrases.
 */
export const RecoverVaultRequestSchema: z.ZodType<{ recoveryKey: string }, { recoveryKey: string }> =
	strictObject({
		recoveryKey: RecoveryKeySchema,
	});

export type RecoverVaultRequest = z.output<typeof RecoverVaultRequestSchema>;
export type RecoverVaultRequestInput = z.input<typeof RecoverVaultRequestSchema>;

export const RecoverVaultResponseSchema: z.ZodType<
	{ vaultId: string; status: 'unlocked' },
	{ vaultId: string; status: 'unlocked' }
> = strictObject({
	vaultId: EntityIdSchema,
	status: z.literal('unlocked'),
});

export type RecoverVaultResponse = z.output<typeof RecoverVaultResponseSchema>;
