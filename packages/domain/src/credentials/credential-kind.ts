/**
 * Supported credential kinds. The actual kind is always stored INSIDE the
 * encrypted payload; the database `record_type` column only ever holds the
 * constant structural discriminator below.
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

/** Constant structural discriminator written to `vault_records.record_type`. */
export const ENCRYPTED_RECORD_TYPE = 'encrypted_payload' as const;
