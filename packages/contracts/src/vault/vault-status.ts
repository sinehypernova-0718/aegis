import { z } from 'zod';

import { strictObject } from '../common/conventions.js';
import { EntityIdSchema } from '../common/ids.js';

export const VaultStatusSchema: z.ZodType<
	'uninitialized' | 'locked' | 'unlocked',
	'uninitialized' | 'locked' | 'unlocked'
> = z.enum(['uninitialized', 'locked', 'unlocked']);

export const VaultStatusResponseSchema: z.ZodType<
	{ status: 'uninitialized' | 'locked' | 'unlocked'; vaultId: string | null },
	{ status: 'uninitialized' | 'locked' | 'unlocked'; vaultId: string | null }
> = strictObject({
	status: VaultStatusSchema,
	vaultId: EntityIdSchema.nullable(),
});

export type VaultStatusResponse = z.output<typeof VaultStatusResponseSchema>;
