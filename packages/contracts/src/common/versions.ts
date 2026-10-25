import { z } from 'zod';

// Versioning is explicit and only used where compatibility requires it. Do not
// add a version field to every contract by default.
export const CONTRACT_VERSION = 1 as const;

export const ContractVersionSchema: z.ZodType<ContractVersion> = z.literal(CONTRACT_VERSION);

export type ContractVersion = typeof CONTRACT_VERSION;
