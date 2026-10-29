export const packageName = '@aegis/crypto' as const;

// ---------------------------------------------------------------------------
// Public API surface for @aegis/crypto.
//
// This entry point intentionally exposes ONLY:
//   - the high-level, opaque session API (the only record-key operations), and
//   - envelope creation/validation and non-secret envelope types/constants.
//
// Low-level key primitives (deriveKek, generateDek, wrapKey, unwrapKey,
// createVaultKeyEnvelope, KDF parameter tables, ...) and the raw-DEK record AEAD
// helpers are package-internal and are NOT exported here. See
// docs/implementation-plan-domain-vertical-slice.md §2.4 / §5.1.
// ---------------------------------------------------------------------------

// High-level session API.
export { createVaultSession } from './vault/create-vault-session.js';
export type {
	CreateVaultSessionInput,
	CreatedVaultSession,
} from './vault/create-vault-session.js';
export { unlockVaultSession } from './vault/unlock-vault-session.js';
export type { UnlockVaultSessionInput } from './vault/unlock-vault-session.js';
export type {
	DecryptRecordInput,
	EncryptRecordInput,
	VaultSession,
} from './session/vault-session.js';
export type { EncryptedRecord } from './records/record-encryption.js';

// Envelope creation (envelope-only; never returns raw keys) and validation.
export { createVaultKeyMaterial } from './vault/create-vault-key-material.js';
export type { CreateVaultKeyMaterialOptions } from './vault/create-vault-key-material.js';
export { validateVaultKeyEnvelope } from './envelope/validate-envelope.js';

// Envelope types and non-secret algorithm/version identifiers.
export type {
	VaultKeyEnvelope,
	VaultKeyEnvelopeKdf,
	VaultKeyEnvelopeWrap,
} from './types.js';
export {
	ENVELOPE_VERSION,
	KDF_ALGORITHM,
	WRAP_ALGORITHM,
	toBase64Url,
	fromBase64Url,
} from './types.js';

// Record encryption format constants (no key material).
export {
	RECORD_ENCRYPTION_VERSION,
	RECORD_AEAD_ALGORITHM,
	RECORD_NONCE_LENGTH,
	RECORD_TAG_LENGTH,
	MAX_RECORD_PLAINTEXT_BYTES,
	MAX_RECORD_CIPHERTEXT_BYTES,
} from './records/record-encryption.js';

// Typed errors.
export {
	CryptoError,
	InvalidParametersError,
	MalformedInputError,
	UnsupportedVersionError,
	AuthenticationError,
	EnvelopeValidationError,
	SessionDisposedError,
	RecordSizeError,
} from './errors.js';
