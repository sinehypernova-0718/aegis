import { z } from 'zod';

import { EntityIdSchema } from '../common/ids.js';
import { strictObject } from '../common/conventions.js';

/** Path parameters for vault-scoped routes. */
export const VaultIdParamsSchema: z.ZodType<{ vaultId: string }, { vaultId: string }> =
	strictObject({
		vaultId: EntityIdSchema,
	});

export type VaultIdParams = z.output<typeof VaultIdParamsSchema>;
