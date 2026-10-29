import { z } from 'zod';

import { EntityIdSchema } from '../common/ids.js';
import { strictObject } from '../common/conventions.js';

/** Path parameters for credential-scoped routes. */
export const CredentialParamsSchema: z.ZodType<
	{ vaultId: string; credentialId: string },
	{ vaultId: string; credentialId: string }
> = strictObject({
	vaultId: EntityIdSchema,
	credentialId: EntityIdSchema,
});

export type CredentialParams = z.output<typeof CredentialParamsSchema>;
