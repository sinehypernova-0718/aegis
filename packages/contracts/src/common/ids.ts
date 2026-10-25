import { z } from 'zod';

import { ENTITY_ID_MAX_LENGTH } from './conventions.js';

// Branded at compile time only. It distinguishes validated identifiers from
// arbitrary strings, but does not prove that an entity exists.
export type EntityId = string & { readonly __brand: 'EntityId' };

export const EntityIdSchema: z.ZodType<EntityId, string> = z
	.string()
	.uuid()
	.max(ENTITY_ID_MAX_LENGTH)
	.brand<'EntityId'>() as unknown as z.ZodType<EntityId, string>;
