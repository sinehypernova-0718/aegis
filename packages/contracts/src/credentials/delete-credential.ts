import { z } from 'zod';

import { EntityIdSchema } from '../common/ids.js';
import { strictObject } from '../common/conventions.js';

export const DeleteCredentialResponseSchema: z.ZodType<
	{ id: string; deleted: true },
	{ id: string; deleted: true }
> = strictObject({
	id: EntityIdSchema,
	deleted: z.literal(true),
});

export type DeleteCredentialResponse = z.output<typeof DeleteCredentialResponseSchema>;
