import type { ErrorCode } from '@aegis/contracts';

/**
 * Base class for typed domain errors. The `contractCode` mirrors the safe,
 * external error code from `@aegis/contracts`; the server boundary maps domain
 * errors to an `ErrorResponse` using it. Domain error messages never contain
 * plaintext secrets, keys, or SQL details. Underlying errors may be attached as
 * `cause` for internal diagnostics only: a cause can carry adapter-level detail
 * (SQL text, constraints, connection info) and must never be serialized into
 * responses or unsafe logs.
 */
export class DomainError extends Error {
	readonly code: string;
	readonly contractCode: ErrorCode;

	constructor(message: string, code: string, contractCode: ErrorCode, options?: ErrorOptions) {
		super(message, options);
		this.name = this.constructor.name;
		this.code = code;
		this.contractCode = contractCode;
	}
}

// --- Vault lifecycle -------------------------------------------------------

export class InvalidVaultInputError extends DomainError {
	constructor(message: string) {
		super(message, 'DOMAIN_INVALID_VAULT_INPUT', 'VALIDATION_ERROR');
	}
}

export class VaultAlreadyInitializedError extends DomainError {
	constructor(message = 'vault is already initialized') {
		super(message, 'DOMAIN_VAULT_ALREADY_INITIALIZED', 'CONFLICT');
	}
}

export class VaultNotFoundError extends DomainError {
	constructor(message = 'vault not found') {
		super(message, 'DOMAIN_VAULT_NOT_FOUND', 'NOT_FOUND');
	}
}

export class VaultLockedError extends DomainError {
	constructor(message = 'vault is locked') {
		super(message, 'DOMAIN_VAULT_LOCKED', 'VAULT_LOCKED');
	}
}

export class VaultAlreadyUnlockedError extends DomainError {
	constructor(message = 'vault is already unlocked') {
		super(message, 'DOMAIN_VAULT_ALREADY_UNLOCKED', 'CONFLICT');
	}
}

export class SessionRegistrationConflictError extends DomainError {
	constructor(message = 'a session is already registered for this vault') {
		super(message, 'DOMAIN_SESSION_REGISTRATION_CONFLICT', 'CONFLICT');
	}
}

export class UnlockRejectedError extends DomainError {
	constructor(message = 'vault unlock was rejected', options?: ErrorOptions) {
		super(message, 'DOMAIN_UNLOCK_REJECTED', 'UNAUTHENTICATED', options);
	}
}

export class InvalidKeyEnvelopeError extends DomainError {
	constructor(message = 'vault key envelope is invalid or unavailable', options?: ErrorOptions) {
		super(message, 'DOMAIN_INVALID_KEY_ENVELOPE', 'VALIDATION_ERROR', options);
	}
}

export class UnsupportedEncryptionFormatError extends DomainError {
	constructor(message = 'unsupported encryption format version', options?: ErrorOptions) {
		super(message, 'DOMAIN_UNSUPPORTED_ENCRYPTION_FORMAT', 'VALIDATION_ERROR', options);
	}
}

// --- Credentials -----------------------------------------------------------

export class CredentialNotFoundError extends DomainError {
	constructor(message = 'credential not found in this vault') {
		super(message, 'DOMAIN_CREDENTIAL_NOT_FOUND', 'NOT_FOUND');
	}
}

export class InvalidCredentialPayloadError extends DomainError {
	constructor(message = 'invalid credential payload', options?: ErrorOptions) {
		super(message, 'DOMAIN_INVALID_CREDENTIAL_PAYLOAD', 'VALIDATION_ERROR', options);
	}
}

export class CredentialDecryptionError extends DomainError {
	constructor(message = 'credential could not be decrypted', options?: ErrorOptions) {
		super(message, 'DOMAIN_CREDENTIAL_DECRYPTION_FAILED', 'VALIDATION_ERROR', options);
	}
}

export class InvalidPaginationError extends DomainError {
	constructor(message = 'invalid pagination parameters') {
		super(message, 'DOMAIN_INVALID_PAGINATION', 'VALIDATION_ERROR');
	}
}

export class InvalidCursorError extends DomainError {
	constructor(message = 'invalid pagination cursor') {
		super(message, 'DOMAIN_INVALID_CURSOR', 'VALIDATION_ERROR');
	}
}

// --- Infrastructure --------------------------------------------------------

export class PersistenceError extends DomainError {
	constructor(message = 'persistence operation failed', options?: ErrorOptions) {
		super(message, 'DOMAIN_PERSISTENCE_FAILED', 'INTERNAL_ERROR', options);
	}
}
