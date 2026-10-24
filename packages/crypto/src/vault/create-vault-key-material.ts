import { clean } from '@noble/ciphers/utils';
import { deriveKek } from '../kdf/derive-key.js';
import { generateDek, DEK_LENGTH } from '../keys/generate-dek.js';
import { wrapKey } from '../keys/wrap-key.js';
import { createVaultKeyEnvelope } from '../envelope/schema.js';
import { validateVaultKeyEnvelope } from '../envelope/validate-envelope.js';
import { MalformedInputError } from '../errors.js';
import type { VaultKeyEnvelope } from '../types.js';

export interface CreateVaultKeyMaterialOptions {
  passphrase: string;
}

export async function createVaultKeyMaterial(
  passphrase: string,
): Promise<VaultKeyEnvelope> {
  if (typeof passphrase !== 'string' || passphrase.length === 0) {
    throw new MalformedInputError('passphrase must be a non-empty string');
  }

  const { kek, salt, params } = await deriveKek({ passphrase });

  let dek: Uint8Array | undefined;
  try {
    dek = generateDek();
    const wrapped = wrapKey(kek, dek);
    const envelope = createVaultKeyEnvelope({
      salt,
      params: {
        memoryKiB: params.memoryKiB,
        passes: params.passes,
        parallelism: params.parallelism,
        tagLength: params.tagLength,
      },
      wrapped,
    });
    // Validate the assembled envelope before returning.
    validateVaultKeyEnvelope(envelope);
    return envelope;
  } finally {
    if (dek) clean(dek);
    clean(kek);
    // salt is persisted in envelope (encoded); no need to zero input? best-effort
  }
}

// Re-export for discoverability
export type { VaultKeyEnvelope };