import { describe, expect, it } from 'vitest';

import { createVaultKeyMaterial } from './vault/create-vault-key-material.js';
import { validateVaultKeyEnvelope } from './envelope/validate-envelope.js';
import { deriveKek } from './kdf/derive-key.js';
import { unwrapKey } from './keys/wrap-key.js';
import { fromBase64Url } from './types.js';

describe('Flow A - initial vault creation', () => {
  it('creates a valid, persistable envelope', async () => {
    const env = await createVaultKeyMaterial('correct horse battery staple');
    expect(env.version).toBe(1);
    expect(env.kdf.algorithm).toBe('argon2id');
    expect(env.wrap.algorithm).toBe('xchacha20-poly1305');
    const reparsed = validateVaultKeyEnvelope(env);
    expect(reparsed).toEqual(env);
  });

  it('can be unlocked with the same passphrase', async () => {
    const passphrase = 'passphrase-123';
    const env = await createVaultKeyMaterial(passphrase);
    const { kek } = await deriveKek({
      passphrase,
      salt: fromBase64Url(env.kdf.salt),
      params: {
        memoryKiB: env.kdf.memoryKiB,
        passes: env.kdf.passes,
        parallelism: env.kdf.parallelism,
        tagLength: env.kdf.tagLength,
        saltLength: fromBase64Url(env.kdf.salt).length,
        algorithm: 'argon2id',
      },
    });
    const dek = unwrapKey(kek, {
      nonce: fromBase64Url(env.wrap.nonce),
      ciphertext: fromBase64Url(env.wrap.ciphertext),
    });
    expect(dek.length).toBe(32);
  });

  it('fails to unwrap with wrong passphrase', async () => {
    const env = await createVaultKeyMaterial('a');
    const { kek } = await deriveKek({
      passphrase: 'b',
      salt: fromBase64Url(env.kdf.salt),
      params: {
        memoryKiB: env.kdf.memoryKiB,
        passes: env.kdf.passes,
        parallelism: env.kdf.parallelism,
        tagLength: env.kdf.tagLength,
        saltLength: fromBase64Url(env.kdf.salt).length,
        algorithm: 'argon2id',
      },
    });
    expect(() =>
      unwrapKey(kek, {
        nonce: fromBase64Url(env.wrap.nonce),
        ciphertext: fromBase64Url(env.wrap.ciphertext),
      }),
    ).toThrow();
  });

  it('rejects malformed envelope', () => {
    expect(() => validateVaultKeyEnvelope({ version: 999 })).toThrow();
  });
});