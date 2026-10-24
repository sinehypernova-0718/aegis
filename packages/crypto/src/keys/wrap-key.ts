import { randomBytes } from 'node:crypto';
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { AuthenticationError, InvalidParametersError } from '../errors.js';
import { DEK_LENGTH } from './generate-dek.js';

export const WRAP_NONCE_LENGTH = 24;
export const WRAP_TAG_LENGTH = 16;
export const WRAP_AAD: Uint8Array = new TextEncoder().encode('aegis:vault-key-wrap:v1');

export interface WrappedKey {
  nonce: Uint8Array;
  ciphertext: Uint8Array; // ciphertext || tag (noble appends tag)
}

export function wrapKey(kek: Uint8Array, dek: Uint8Array, aad: Uint8Array = WRAP_AAD): WrappedKey {
  if (!(kek instanceof Uint8Array) || kek.length !== 32) {
    throw new InvalidParametersError('KEK must be 32 bytes');
  }
  if (!(dek instanceof Uint8Array) || dek.length !== DEK_LENGTH) {
    throw new InvalidParametersError('DEK must be 32 bytes');
  }
  const nonce = new Uint8Array(randomBytes(WRAP_NONCE_LENGTH));
  const cipher = xchacha20poly1305(kek, nonce, aad);
  const ciphertext = cipher.encrypt(dek);
  return { nonce, ciphertext };
}

export function unwrapKey(
  kek: Uint8Array,
  wrapped: { nonce: Uint8Array; ciphertext: Uint8Array },
  aad: Uint8Array = WRAP_AAD,
): Uint8Array {
  if (!(kek instanceof Uint8Array) || kek.length !== 32) {
    throw new InvalidParametersError('KEK must be 32 bytes');
  }
  if (!(wrapped?.nonce instanceof Uint8Array) || wrapped.nonce.length !== WRAP_NONCE_LENGTH) {
    throw new InvalidParametersError('wrapped nonce must be 24 bytes');
  }
  if (!(wrapped?.ciphertext instanceof Uint8Array) || wrapped.ciphertext.length !== DEK_LENGTH + WRAP_TAG_LENGTH) {
    throw new InvalidParametersError('wrapped ciphertext length invalid');
  }
  const cipher = xchacha20poly1305(kek, wrapped.nonce, aad);
  let dek: Uint8Array;
  try {
    dek = cipher.decrypt(wrapped.ciphertext);
  } catch {
    throw new AuthenticationError('DEK unwrap failed (wrong passphrase or tampering)');
  }
  if (dek.length !== DEK_LENGTH) {
    throw new AuthenticationError('DEK unwrap produced invalid length');
  }
  return dek;
}