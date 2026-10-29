import { z } from 'zod';

import { strictObject } from '../common/conventions.js';
import {
	CredentialPayloadInputSchema,
	type CredentialPayloadFields,
	type CredentialPayloadInput,
} from './credential-payload.js';
import { CredentialSummarySchema, type CredentialSummary } from './credential-summary.js';

export interface CreateCredentialRequest {
	payload: CredentialPayloadFields;
}

export interface CreateCredentialRequestInput {
	payload: CredentialPayloadInput;
}

export const CreateCredentialRequestSchema: z.ZodType<
	CreateCredentialRequest,
	CreateCredentialRequestInput
> = strictObject({
	payload: CredentialPayloadInputSchema,
});

/**
 * Creation returns a secret-free summary. The secret is available only through
 * the dedicated detail endpoint.
 */
export const CreateCredentialResponseSchema: z.ZodType<CredentialSummary, CredentialSummary> =
	CredentialSummarySchema;

export type CreateCredentialResponse = CredentialSummary;
