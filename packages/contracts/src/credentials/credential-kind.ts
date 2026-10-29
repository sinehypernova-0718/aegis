import { z } from 'zod';

/**
 * Supported credential kinds.
 *
 * This list mirrors `@aegis/domain`'s `CREDENTIAL_KINDS` (the domain owns the
 * at-rest payload schema). It is duplicated here so the contracts package stays
 * dependency-free; the two lists are asserted to match by the domain tests.
 */
export const CREDENTIAL_KINDS = [
	'password',
	'api_key',
	'access_token',
	'refresh_token',
	'ssh_key',
	'certificate',
	'recovery_code',
	'secure_note',
] as const;

export type CredentialKind = (typeof CREDENTIAL_KINDS)[number];

export const CredentialKindSchema: z.ZodType<CredentialKind, CredentialKind> =
	z.enum(CREDENTIAL_KINDS);
