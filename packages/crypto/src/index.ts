export const packageName = '@aegis/crypto' as const;

// Public, reviewed API surface for Flow A (initial vault creation).
export { createVaultKeyMaterial } from './vault/create-vault-key-material.js';
export type { CreateVaultKeyMaterialOptions } from './vault/create-vault-key-material.js';

export { deriveKek, generateSalt } from './kdf/derive-key.js';
export type { DeriveKekInput, DerivedKek } from './kdf/derive-key.js';

export { KDF_DEFAULTS, KDF_MINIMUMS, KDF_MAXIMUMS, validateKdfParameters } from './kdf/parameters.js';
export type { KdfParameters } from './kdf/parameters.js';

export { generateDek, DEK_LENGTH } from './keys/generate-dek.js';

export { wrapKey, unwrapKey, WRAP_AAD } from './keys/wrap-key.js';
export type { WrappedKey } from './keys/wrap-key.js';

export { createVaultKeyEnvelope } from './envelope/schema.js';

export { validateVaultKeyEnvelope } from './envelope/validate-envelope.js';

export type {
  VaultKeyEnvelope,
  VaultKeyEnvelopeKdf,
  VaultKeyEnvelopeWrap,
  KdfAlgorithm,
  WrapAlgorithm,
} from './types.js';

export { ENVELOPE_VERSION, KDF_ALGORITHM, WRAP_ALGORITHM, toBase64Url, fromBase64Url } from './types.js';

export {
  CryptoError,
  InvalidParametersError,
  MalformedInputError,
  UnsupportedVersionError,
  AuthenticationError,
  EnvelopeValidationError,
} from './errors.js';