import {
	CredentialDecryptionError,
	InvalidCredentialPayloadError,
	InvalidKeyEnvelopeError,
	PersistenceError,
	UnlockRejectedError,
	UnsupportedEncryptionFormatError,
} from './domain-errors.js';

// ---------------------------------------------------------------------------
// Cross-boundary error inspection.
//
// The domain deliberately does not import `@aegis/database` or the crypto error
// classes. Adapters (Drizzle repositories, `@aegis/crypto`) are consumed
// structurally, so the domain recognizes their failures by stable `name`/`code`
// markers. This keeps the dependency graph clean without leaking adapter types.
// ---------------------------------------------------------------------------

/** True when the error is a database unique-constraint violation. */
export function isUniqueViolation(error: unknown): boolean {
	return errorName(error) === 'UniqueConstraintViolationError';
}

/** True when the error is a database "record not found". */
export function isRecordNotFound(error: unknown): boolean {
	return errorName(error) === 'RecordNotFoundError';
}

function errorName(error: unknown): string | undefined {
	return typeof error === 'object' && error !== null && typeof (error as { name?: unknown }).name === 'string'
		? (error as { name: string }).name
		: undefined;
}

function cryptoErrorCode(error: unknown): string | undefined {
	return typeof error === 'object' &&
		error !== null &&
		typeof (error as { code?: unknown }).code === 'string'
		? (error as { code: string }).code
		: undefined;
}

/** Map an envelope-validation failure from crypto to a domain error. */
export function mapEnvelopeValidationError(error: unknown): Error {
	if (cryptoErrorCode(error) === 'CRYPTO_UNSUPPORTED_VERSION') {
		return new UnsupportedEncryptionFormatError('unsupported key envelope version', { cause: error });
	}
	return new InvalidKeyEnvelopeError('vault key envelope is invalid', { cause: error });
}

/** Map an unlock failure from crypto to a safe domain error. */
export function mapUnlockError(error: unknown): Error {
	switch (cryptoErrorCode(error)) {
		case 'CRYPTO_UNSUPPORTED_VERSION':
			return new UnsupportedEncryptionFormatError('unsupported key envelope version', {
				cause: error,
			});
		case 'CRYPTO_ENVELOPE_INVALID':
		case 'CRYPTO_MALFORMED_INPUT':
		case 'CRYPTO_INVALID_PARAMETERS':
			return new InvalidKeyEnvelopeError('vault key envelope is invalid', { cause: error });
		default:
			// Wrong passphrase, tampering, or any other crypto failure: a single
			// generic rejection that does not distinguish causes.
			return new UnlockRejectedError('vault unlock was rejected', { cause: error });
	}
}

/** Map a record decryption failure from a session to a domain error. */
export function mapDecryptionError(error: unknown): Error {
	if (cryptoErrorCode(error) === 'CRYPTO_UNSUPPORTED_VERSION') {
		return new UnsupportedEncryptionFormatError('unsupported record encryption version', {
			cause: error,
		});
	}
	return new CredentialDecryptionError('credential could not be decrypted', { cause: error });
}

/** Wrap an unexpected persistence/adapter failure. */
export function asPersistenceError(error: unknown, message: string): PersistenceError {
	if (error instanceof PersistenceError) return error;
	return new PersistenceError(message, { cause: error });
}

/** Map a record-encryption failure (oversize, etc.) to a domain error. */
export function mapRecordEncryptionError(error: unknown): Error {
	if (cryptoErrorCode(error) === 'CRYPTO_RECORD_SIZE') {
		return new InvalidCredentialPayloadError('credential payload exceeds the record size limit', {
			cause: error,
		});
	}
	return error instanceof Error ? error : new Error('record encryption failed');
}
