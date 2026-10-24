// Stable, typed errors for the crypto package. Messages never include
// sensitive plaintext or key material.

export class CryptoError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

export class InvalidParametersError extends CryptoError {
  constructor(message: string) {
    super(message, 'CRYPTO_INVALID_PARAMETERS');
  }
}

export class MalformedInputError extends CryptoError {
  constructor(message: string) {
    super(message, 'CRYPTO_MALFORMED_INPUT');
  }
}

export class UnsupportedVersionError extends CryptoError {
  constructor(message: string) {
    super(message, 'CRYPTO_UNSUPPORTED_VERSION');
  }
}

export class AuthenticationError extends CryptoError {
  constructor(message = 'Authentication failed') {
    super(message, 'CRYPTO_AUTHENTICATION_FAILED');
  }
}

export class EnvelopeValidationError extends CryptoError {
  constructor(message: string) {
    super(message, 'CRYPTO_ENVELOPE_INVALID');
  }
}