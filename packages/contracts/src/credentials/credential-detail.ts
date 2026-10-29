import { z } from 'zod';

import { IsoUtcTimestampSchema } from '../common/timestamps.js';
import { EntityIdSchema } from '../common/ids.js';
import { strictObject } from '../common/conventions.js';
import {
	CredentialPayloadSchema,
	type CredentialPayload,
	type StoredCredentialPayloadInput,
} from './credential-payload.js';

/** Full credential detail, including the secret, returned only on request. */
export interface CredentialDetail {
	id: string;
	createdAt: string;
	updatedAt: string;
	payload: CredentialPayload;
}

/** Input shape accepted by the detail schema (payload tags may be omitted). */
export interface CredentialDetailInput {
	id: string;
	createdAt: string;
	updatedAt: string;
	payload: StoredCredentialPayloadInput;
}

/**
 * Full credential detail. This is the only read shape that carries the secret
 * (and notes); it is returned only by the explicitly requested detail endpoint.
 */
export const CredentialDetailSchema: z.ZodType<CredentialDetail, CredentialDetailInput> =
	strictObject({
		id: EntityIdSchema,
		createdAt: IsoUtcTimestampSchema,
		updatedAt: IsoUtcTimestampSchema,
		payload: CredentialPayloadSchema,
	});
