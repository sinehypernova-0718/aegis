import {
  ENVELOPE_VERSION,
  toBase64Url,
  fromBase64Url,
  KDF_ALGORITHM,
  WRAP_ALGORITHM,
} from '../types.js';
import type {
  VaultKeyEnvelope,
  VaultKeyEnvelopeKdf,
  VaultKeyEnvelopeWrap,
} from '../types.js';

export { ENVELOPE_VERSION, toBase64Url, fromBase64Url };

export interface CreateEnvelopeInput {
  salt: Uint8Array;
  params: {
    memoryKiB: number;
    passes: number;
    parallelism: number;
    tagLength: number;
  };
  wrapped: { nonce: Uint8Array; ciphertext: Uint8Array };
}

export function createVaultKeyEnvelope(input: CreateEnvelopeInput): VaultKeyEnvelope {
  const { salt, params, wrapped } = input;
  const kdf: VaultKeyEnvelopeKdf = {
    algorithm: KDF_ALGORITHM,
    salt: toBase64Url(salt),
    memoryKiB: params.memoryKiB,
    passes: params.passes,
    parallelism: params.parallelism,
    tagLength: params.tagLength,
  };
  const wrap: VaultKeyEnvelopeWrap = {
    algorithm: WRAP_ALGORITHM,
    nonce: toBase64Url(wrapped.nonce),
    ciphertext: toBase64Url(wrapped.ciphertext),
  };
  return { version: ENVELOPE_VERSION, kdf, wrap };
}