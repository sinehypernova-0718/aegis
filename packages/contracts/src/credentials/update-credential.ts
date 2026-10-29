import { z } from 'zod';

import { IsoUtcTimestampSchema } from '../common/timestamps.js';
import { EntityIdSchema } from '../common/ids.js';
import { strictObject } from '../common/conventions.js';
import {
	CredentialPayloadInputSchema,
	type CredentialPayloadFields,
	type CredentialPayloadInput,
} from './credential-payload.js';

export interface UpdateCredentialRequest {
	payload: CredentialPayloadFields;
}

export interface UpdateCredentialRequestInput {
	payload: CredentialPayloadInput;
}

export const UpdateCredentialRequestSchema: z.ZodType<
	UpdateCredentialRequest,
	UpdateCredentialRequestInput
> = strictObject({
	payload: CredentialPayloadInputSchema,
});

export interface UpdateCredentialResponse {
	id: string;
	updatedAt: string;
}

/**
 * Update returns only the affected identity and timestamp; it never echoes the
 * submitted secret back to the client.
 */
export const UpdateCredentialResponseSchema: z.ZodType<
	UpdateCredentialResponse,
	UpdateCredentialResponse
> = strictObject({
	id: EntityIdSchema,
	updatedAt: IsoUtcTimestampSchema,
});
