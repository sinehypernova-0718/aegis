import { z } from 'zod';

import { EntityIdSchema } from '../common/ids.js';
import { strictObject } from '../common/conventions.js';

/**
 * Locking is a parameterless operation (the vault is identified by the path).
 * No request body is required or accepted.
 */
export const LockVaultResponseSchema: z.ZodType<
	{ vaultId: string; status: 'locked' },
	{ vaultId: string; status: 'locked' }
> = strictObject({
	vaultId: EntityIdSchema,
	status: z.literal('locked'),
});

export type LockVaultResponse = z.output<typeof LockVaultResponseSchema>;
