import { z } from 'zod';

import { CredentialKindSchema, type CredentialKind } from './credential-kind.js';
import { IsoUtcTimestampSchema } from '../common/timestamps.js';
import { EntityIdSchema } from '../common/ids.js';
import { boundedNonBlankString, strictObject } from '../common/conventions.js';
import {
	CREDENTIAL_MAX_TAGS,
	CREDENTIAL_NAME_MAX_LENGTH,
	CREDENTIAL_TAG_MAX_LENGTH,
	CREDENTIAL_URL_MAX_LENGTH,
	CREDENTIAL_USERNAME_MAX_LENGTH,
} from './credential-payload.js';

/**
 * Secret-free credential projection used for list responses.
 *
 * `secret` and `notes` are deliberately absent: notes may contain sensitive
 * free text and are only returned by the explicit detail endpoint.
 */
export interface CredentialSummary {
	id: string;
	createdAt: string;
	updatedAt: string;
	type: CredentialKind;
	name: string;
	username?: string | undefined;
	url?: string | undefined;
	tags: string[];
	expiresAt?: string | undefined;
}

export const CredentialSummarySchema: z.ZodType<CredentialSummary, CredentialSummary> =
	strictObject({
		id: EntityIdSchema,
		createdAt: IsoUtcTimestampSchema,
		updatedAt: IsoUtcTimestampSchema,
		type: CredentialKindSchema,
		name: boundedNonBlankString(1, CREDENTIAL_NAME_MAX_LENGTH),
		username: boundedNonBlankString(1, CREDENTIAL_USERNAME_MAX_LENGTH).optional(),
		url: boundedNonBlankString(1, CREDENTIAL_URL_MAX_LENGTH).optional(),
		tags: z.array(boundedNonBlankString(1, CREDENTIAL_TAG_MAX_LENGTH)).max(CREDENTIAL_MAX_TAGS),
		expiresAt: IsoUtcTimestampSchema.optional(),
	});
