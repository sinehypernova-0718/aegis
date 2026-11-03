import { z } from 'zod';

import { strictObject } from '../common/conventions.js';

export interface CredentialCounts {
	credentialCount: number;
	passwordCount: number;
	apiKeyCount: number;
	tokenCount: number;
	sshKeyCount: number;
	oauth2Count: number;
	secureNoteCount: number;
}

const CountSchema = z.number().int().nonnegative();

export const CredentialCountsSchema: z.ZodType<CredentialCounts, CredentialCounts> = strictObject({
	credentialCount: CountSchema,
	passwordCount: CountSchema,
	apiKeyCount: CountSchema,
	tokenCount: CountSchema,
	sshKeyCount: CountSchema,
	oauth2Count: CountSchema,
	secureNoteCount: CountSchema,
});
