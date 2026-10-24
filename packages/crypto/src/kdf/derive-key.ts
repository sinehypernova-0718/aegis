import { argon2 } from 'node:crypto';
import { randomBytes } from 'node:crypto';
import { InvalidParametersError, MalformedInputError } from '../errors.js';
import { validateKdfParameters, KDF_DEFAULTS, type KdfParameters } from './parameters.js';
import { KDF_ALGORITHM } from '../types.js';

export function generateSalt(length: number = KDF_DEFAULTS.saltLength): Uint8Array {
  if (!Number.isInteger(length) || length < 16 || length > 64) {
    throw new InvalidParametersError('salt length out of range');
  }
  return new Uint8Array(randomBytes(length));
}

export interface DeriveKekInput {
  passphrase: string;
  salt?: Uint8Array;
  params?: Partial<KdfParameters>;
}

export interface DerivedKek {
  kek: Uint8Array;
  salt: Uint8Array;
  params: KdfParameters;
}

export async function deriveKek(input: DeriveKekInput): Promise<DerivedKek> {
  const { passphrase, salt, params } = input;
  if (typeof passphrase !== 'string' || passphrase.length === 0) {
    throw new MalformedInputError('passphrase must be a non-empty string');
  }
  const resolvedParams = validateKdfParameters(params ?? {});

  let resolvedSalt: Uint8Array;
  if (salt === undefined) {
    resolvedSalt = generateSalt(resolvedParams.saltLength);
  } else {
    if (!(salt instanceof Uint8Array) || salt.length < 16 || salt.length > 64) {
      throw new MalformedInputError('salt must be 16-64 bytes');
    }
    resolvedSalt = salt;
    // keep resolved saltLength consistent with provided salt
    resolvedParams.saltLength = resolvedSalt.length;
  }

  const kekBuffer = await new Promise<Buffer>((resolve, reject) => {
    argon2(
      KDF_ALGORITHM,
      {
        message: Buffer.from(passphrase, 'utf8'),
        nonce: Buffer.from(resolvedSalt),
        parallelism: resolvedParams.parallelism,
        tagLength: resolvedParams.tagLength,
        memory: resolvedParams.memoryKiB,
        passes: resolvedParams.passes,
        secret: Buffer.alloc(0),
        associatedData: Buffer.alloc(0),
      },
      (err, derived) => {
        if (err) reject(err);
        else resolve(derived);
      },
    );
  });

  const kek = new Uint8Array(kekBuffer);
  // Best-effort only: Node/V8 may retain copies. No guarantee of erasure.
  try {
    kekBuffer.fill(0);
  } catch {
    // ignore
  }
  return { kek, salt: resolvedSalt, params: resolvedParams };
}