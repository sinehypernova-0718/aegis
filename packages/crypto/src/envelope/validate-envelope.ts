import {
  ENVELOPE_VERSION,
  fromBase64Url,
  KDF_ALGORITHM,
  WRAP_ALGORITHM,
} from '../types.js';
import type {
  VaultKeyEnvelope,
  VaultKeyEnvelopeKdf,
  VaultKeyEnvelopeWrap,
} from '../types.js';
import { EnvelopeValidationError, InvalidParametersError, MalformedInputError, UnsupportedVersionError } from '../errors.js';
import { KDF_MINIMUMS, KDF_MAXIMUMS } from '../kdf/parameters.js';
import { DEK_LENGTH } from '../keys/generate-dek.js';
import { WRAP_NONCE_LENGTH, WRAP_TAG_LENGTH } from '../keys/wrap-key.js';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function expectString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string') throw new EnvelopeValidationError(`${key} must be a string`);
  return v;
}

function expectNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new EnvelopeValidationError(`${key} must be a finite number`);
  return v;
}

export function validateVaultKeyEnvelope(input: unknown): VaultKeyEnvelope {
  if (!isRecord(input)) throw new EnvelopeValidationError('envelope must be an object');

  const version = expectNumber(input, 'version');
  if (version !== ENVELOPE_VERSION) {
    throw new UnsupportedVersionError(`unsupported envelope version: ${version}`);
  }

  if (!isRecord(input.kdf)) throw new EnvelopeValidationError('kdf must be an object');
  if (!isRecord(input.wrap)) throw new EnvelopeValidationError('wrap must be an object');

  const k = input.kdf as Record<string, unknown>;
  const w = input.wrap as Record<string, unknown>;

  if (k.algorithm !== KDF_ALGORITHM) throw new EnvelopeValidationError('unsupported kdf algorithm');
  if (w.algorithm !== WRAP_ALGORITHM) throw new EnvelopeValidationError('unsupported wrap algorithm');

  const saltStr = expectString(k, 'salt');
  const memoryKiB = expectNumber(k, 'memoryKiB');
  const passes = expectNumber(k, 'passes');
  const parallelism = expectNumber(k, 'parallelism');
  const tagLength = expectNumber(k, 'tagLength');

  if (!Number.isInteger(memoryKiB) || memoryKiB < KDF_MINIMUMS.memoryKiB || memoryKiB > KDF_MAXIMUMS.memoryKiB) {
    throw new InvalidParametersError('kdf memoryKiB out of range');
  }
  if (!Number.isInteger(passes) || passes < KDF_MINIMUMS.passes || passes > KDF_MAXIMUMS.passes) {
    throw new InvalidParametersError('kdf passes out of range');
  }
  if (!Number.isInteger(parallelism) || parallelism < KDF_MINIMUMS.parallelism || parallelism > KDF_MAXIMUMS.parallelism) {
    throw new InvalidParametersError('kdf parallelism out of range');
  }
  if (tagLength !== 32) {
    throw new InvalidParametersError('kdf tagLength must be exactly 32');
  }

  let saltBytes: Uint8Array;
  try {
    saltBytes = fromBase64Url(saltStr);
  } catch {
    throw new MalformedInputError('kdf salt is not valid base64url');
  }
  if (saltBytes.length < KDF_MINIMUMS.saltLength || saltBytes.length > KDF_MAXIMUMS.saltLength) {
    throw new EnvelopeValidationError('kdf salt length out of range');
  }

  // wrap fields
  const nonceStr = expectString(w, 'nonce');
  const ctStr = expectString(w, 'ciphertext');

  let nonceBytes: Uint8Array;
  let ctBytes: Uint8Array;
  try {
    nonceBytes = fromBase64Url(nonceStr);
    ctBytes = fromBase64Url(ctStr);
  } catch {
    throw new MalformedInputError('wrap fields are not valid base64url');
  }
  if (nonceBytes.length !== WRAP_NONCE_LENGTH) {
    throw new EnvelopeValidationError(`wrap nonce must be ${WRAP_NONCE_LENGTH} bytes`);
  }
  if (ctBytes.length !== DEK_LENGTH + WRAP_TAG_LENGTH) {
    throw new EnvelopeValidationError('wrap ciphertext length invalid');
  }

  const kdf: VaultKeyEnvelopeKdf = {
    algorithm: KDF_ALGORITHM,
    salt: saltStr,
    memoryKiB,
    passes,
    parallelism,
    tagLength,
  };
  const wrap: VaultKeyEnvelopeWrap = {
    algorithm: WRAP_ALGORITHM,
    nonce: nonceStr,
    ciphertext: ctStr,
  };
  return { version: ENVELOPE_VERSION, kdf, wrap };
}