import { describe, expect, it } from 'vitest';

import { createVaultKeyMaterial } from './vault/create-vault-key-material.js';
import { validateVaultKeyEnvelope } from './envelope/validate-envelope.js';
import { deriveKek, generateSalt } from './kdf/derive-key.js';
import { validateKdfParameters, KDF_DEFAULTS } from './kdf/parameters.js';
import { unwrapKey } from './keys/wrap-key.js';
import { fromBase64Url, toBase64Url } from './types.js';
import {
  AuthenticationError,
  InvalidParametersError,
  MalformedInputError,
  UnsupportedVersionError,
  EnvelopeValidationError,
} from './errors.js';

describe('Flow A - initial vault creation', () => {
  it('creates a valid, persistable envelope', async () => {
    const env = await createVaultKeyMaterial('correct horse battery staple');
    expect(env.version).toBe(1);
    expect(env.kdf.algorithm).toBe('argon2id');
    expect(env.wrap.algorithm).toBe('xchacha20-poly1305');
    const reparsed = validateVaultKeyEnvelope(env);
    expect(reparsed).toEqual(env);
  });

  it('uses supported salt/nonce/ciphertext lengths', async () => {
    const env = await createVaultKeyMaterial('pw');
    const salt = fromBase64Url(env.kdf.salt);
    const nonce = fromBase64Url(env.wrap.nonce);
    const ciphertext = fromBase64Url(env.wrap.ciphertext);
    expect(salt.length).toBe(16);
    expect(nonce.length).toBe(24);
    expect(ciphertext.length).toBe(32 + 16);
  });

  it('creates distinct random salt/nonce/ciphertext per vault', async () => {
    const a = await createVaultKeyMaterial('same-passphrase');
    const b = await createVaultKeyMaterial('same-passphrase');
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.wrap.nonce).not.toBe(b.wrap.nonce);
    expect(a.wrap.ciphertext).not.toBe(b.wrap.ciphertext);
  });

  it('can be unlocked with the same passphrase', async () => {
    const passphrase = 'passphrase-123';
    const env = await createVaultKeyMaterial(passphrase);
    const { kek } = await deriveKek({
      passphrase,
      salt: fromBase64Url(env.kdf.salt),
      params: {
        algorithm: 'argon2id',
        memoryKiB: env.kdf.memoryKiB,
        passes: env.kdf.passes,
        parallelism: env.kdf.parallelism,
        tagLength: env.kdf.tagLength,
        saltLength: fromBase64Url(env.kdf.salt).length,
      },
    });
    const dek = unwrapKey(kek, {
      nonce: fromBase64Url(env.wrap.nonce),
      ciphertext: fromBase64Url(env.wrap.ciphertext),
    });
    expect(dek.length).toBe(32);
  });

  it('rejects wrong passphrase', async () => {
    const env = await createVaultKeyMaterial('a');
    const { kek } = await deriveKek({
      passphrase: 'b',
      salt: fromBase64Url(env.kdf.salt),
      params: {
        algorithm: 'argon2id',
        memoryKiB: env.kdf.memoryKiB,
        passes: env.kdf.passes,
        parallelism: env.kdf.parallelism,
        tagLength: env.kdf.tagLength,
        saltLength: fromBase64Url(env.kdf.salt).length,
      },
    });
    expect(() =>
      unwrapKey(kek, {
        nonce: fromBase64Url(env.wrap.nonce),
        ciphertext: fromBase64Url(env.wrap.ciphertext),
      }),
    ).toThrow(AuthenticationError);
  });

  it('rejects tampered ciphertext', async () => {
    const env = await createVaultKeyMaterial('pw');
    const ct = fromBase64Url(env.wrap.ciphertext);
    ct[ct.length - 1] = ((ct[ct.length - 1] as number) ^ 0x01) as number;
    const tampered = { ...env, wrap: { ...env.wrap, ciphertext: toBase64Url(ct) } };
    // envelope still structurally valid
    validateVaultKeyEnvelope(tampered);
    const { kek } = await deriveKek({
      passphrase: 'pw',
      salt: fromBase64Url(env.kdf.salt),
      params: {
        algorithm: 'argon2id',
        memoryKiB: env.kdf.memoryKiB,
        passes: env.kdf.passes,
        parallelism: env.kdf.parallelism,
        tagLength: env.kdf.tagLength,
        saltLength: fromBase64Url(env.kdf.salt).length,
      },
    });
    expect(() =>
      unwrapKey(kek, {
        nonce: fromBase64Url(env.wrap.nonce),
        ciphertext: fromBase64Url(tampered.wrap.ciphertext),
      }),
    ).toThrow(AuthenticationError);
  });

  it('rejects tampered nonce', async () => {
    const env = await createVaultKeyMaterial('pw');
    const nonce = fromBase64Url(env.wrap.nonce);
    nonce[0] = ((nonce[0] as number) ^ 0x01) as number;
    const { kek } = await deriveKek({
      passphrase: 'pw',
      salt: fromBase64Url(env.kdf.salt),
      params: {
        algorithm: 'argon2id',
        memoryKiB: env.kdf.memoryKiB,
        passes: env.kdf.passes,
        parallelism: env.kdf.parallelism,
        tagLength: env.kdf.tagLength,
        saltLength: fromBase64Url(env.kdf.salt).length,
      },
    });
    expect(() =>
      unwrapKey(kek, {
        nonce,
        ciphertext: fromBase64Url(env.wrap.ciphertext),
      }),
    ).toThrow(AuthenticationError);
  });

  it('rejects malformed base64url in envelope', () => {
    const env = {
      version: 1,
      kdf: {
        algorithm: 'argon2id',
        salt: '!!!not-base64!!!',
        memoryKiB: KDF_DEFAULTS.memoryKiB,
        passes: KDF_DEFAULTS.passes,
        parallelism: KDF_DEFAULTS.parallelism,
        tagLength: KDF_DEFAULTS.tagLength,
      },
      wrap: {
        algorithm: 'xchacha20-poly1305',
        nonce: toBase64Url(new Uint8Array(24)),
        ciphertext: toBase64Url(new Uint8Array(48)),
      },
    };
    expect(() => validateVaultKeyEnvelope(env)).toThrow(MalformedInputError);
  });

  it('rejects malformed envelope structure and types', () => {
    expect(() => validateVaultKeyEnvelope(null)).toThrow(EnvelopeValidationError);
    expect(() => validateVaultKeyEnvelope({})).toThrow(EnvelopeValidationError);
    const bad = {
      version: 1,
      kdf: 'not-object',
      wrap: {
        algorithm: 'xchacha20-poly1305',
        nonce: toBase64Url(new Uint8Array(24)),
        ciphertext: toBase64Url(new Uint8Array(48)),
      },
    };
    expect(() => validateVaultKeyEnvelope(bad)).toThrow(EnvelopeValidationError);
  });

  it('rejects non-canonical base64url', () => {
    // trailing bits (decodes but re-encodes differently)
    // 'AB' decodes to the same byte as 'AA' but has non-canonical padding bits.
    expect(() => fromBase64Url('AB')).toThrow(MalformedInputError);
  });

  it('rejects unsupported envelope version', () => {
    const env = {
      version: 2,
      kdf: {
        algorithm: 'argon2id',
        salt: toBase64Url(new Uint8Array(16)),
        memoryKiB: KDF_DEFAULTS.memoryKiB,
        passes: KDF_DEFAULTS.passes,
        parallelism: KDF_DEFAULTS.parallelism,
        tagLength: KDF_DEFAULTS.tagLength,
      },
      wrap: {
        algorithm: 'xchacha20-poly1305',
        nonce: toBase64Url(new Uint8Array(24)),
        ciphertext: toBase64Url(new Uint8Array(48)),
      },
    };
    expect(() => validateVaultKeyEnvelope(env)).toThrow(UnsupportedVersionError);
  });

  it('rejects unsupported KDF algorithm in validateKdfParameters (no default overwrite)', () => {
    expect(() =>
      validateKdfParameters({ algorithm: 'scrypt' as unknown as 'argon2id' }),
    ).toThrow(InvalidParametersError);
  });

  it('rejects unsupported algorithm in envelope', () => {
    const env = {
      version: 1,
      kdf: {
        algorithm: 'pbkdf2',
        salt: toBase64Url(new Uint8Array(16)),
        memoryKiB: KDF_DEFAULTS.memoryKiB,
        passes: KDF_DEFAULTS.passes,
        parallelism: KDF_DEFAULTS.parallelism,
        tagLength: KDF_DEFAULTS.tagLength,
      },
      wrap: {
        algorithm: 'xchacha20-poly1305',
        nonce: toBase64Url(new Uint8Array(24)),
        ciphertext: toBase64Url(new Uint8Array(48)),
      },
    };
    expect(() => validateVaultKeyEnvelope(env)).toThrow(EnvelopeValidationError);
  });

  it('rejects unsupported wrap algorithm in envelope', () => {
    const env = {
      version: 1,
      kdf: {
        algorithm: 'argon2id',
        salt: toBase64Url(new Uint8Array(16)),
        memoryKiB: KDF_DEFAULTS.memoryKiB,
        passes: KDF_DEFAULTS.passes,
        parallelism: KDF_DEFAULTS.parallelism,
        tagLength: KDF_DEFAULTS.tagLength,
      },
      wrap: {
        algorithm: 'aes-256-gcm',
        nonce: toBase64Url(new Uint8Array(24)),
        ciphertext: toBase64Url(new Uint8Array(48)),
      },
    };
    expect(() => validateVaultKeyEnvelope(env)).toThrow(EnvelopeValidationError);
  });

  it('rejects undersized KDF memory before invoking Argon2', async () => {
    await expect(
      deriveKek({
        passphrase: 'pw',
        salt: new Uint8Array(16),
        params: { memoryKiB: 1024, passes: 3, parallelism: 4, tagLength: 32, saltLength: 16 },
      }),
    ).rejects.toThrow(InvalidParametersError);
  });

  it('rejects excessive KDF memory before invoking Argon2', async () => {
    await expect(
      deriveKek({
        passphrase: 'pw',
        salt: new Uint8Array(16),
        params: { memoryKiB: 1024 * 1024 * 4, passes: 3, parallelism: 4, tagLength: 32, saltLength: 16 },
      }),
    ).rejects.toThrow(InvalidParametersError);
  });

  it('rejects out-of-range KDF passes/parallelism', () => {
    expect(() => validateKdfParameters({ passes: 1 })).toThrow(InvalidParametersError);
    expect(() => validateKdfParameters({ passes: 100 })).toThrow(InvalidParametersError);
    expect(() => validateKdfParameters({ parallelism: 0 })).toThrow(InvalidParametersError);
    expect(() => validateKdfParameters({ parallelism: 1000 })).toThrow(InvalidParametersError);
  });

  it('accepts the package default KDF parameters', () => {
    expect(() => validateKdfParameters({})).not.toThrow();
    const v = validateKdfParameters({});
    expect(v).toEqual(KDF_DEFAULTS);
  });

  it('rejects wrong salt length in envelope', () => {
    const env = {
      version: 1,
      kdf: {
        algorithm: 'argon2id',
        salt: toBase64Url(new Uint8Array(8)),
        memoryKiB: KDF_DEFAULTS.memoryKiB,
        passes: KDF_DEFAULTS.passes,
        parallelism: KDF_DEFAULTS.parallelism,
        tagLength: KDF_DEFAULTS.tagLength,
      },
      wrap: {
        algorithm: 'xchacha20-poly1305',
        nonce: toBase64Url(new Uint8Array(24)),
        ciphertext: toBase64Url(new Uint8Array(48)),
      },
    };
    expect(() => validateVaultKeyEnvelope(env)).toThrow(EnvelopeValidationError);
  });

  it('rejects wrong nonce/ciphertext lengths in envelope', () => {
    const env1 = {
      version: 1,
      kdf: {
        algorithm: 'argon2id',
        salt: toBase64Url(new Uint8Array(16)),
        memoryKiB: KDF_DEFAULTS.memoryKiB,
        passes: KDF_DEFAULTS.passes,
        parallelism: KDF_DEFAULTS.parallelism,
        tagLength: KDF_DEFAULTS.tagLength,
      },
      wrap: {
        algorithm: 'xchacha20-poly1305',
        nonce: toBase64Url(new Uint8Array(12)),
        ciphertext: toBase64Url(new Uint8Array(48)),
      },
    };
    expect(() => validateVaultKeyEnvelope(env1)).toThrow(EnvelopeValidationError);
    const env2 = { ...env1, wrap: { ...env1.wrap, nonce: toBase64Url(new Uint8Array(24)), ciphertext: toBase64Url(new Uint8Array(32)) } };
    expect(() => validateVaultKeyEnvelope(env2)).toThrow(EnvelopeValidationError);
  });

  it('generateSalt respects length', () => {
    const s = generateSalt(32);
    expect(s.length).toBe(32);
  });
});