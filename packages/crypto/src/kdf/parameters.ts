import { InvalidParametersError } from '../errors.js';
import { KDF_ALGORITHM } from '../types.js';

export interface KdfParameters {
  algorithm: typeof KDF_ALGORITHM;
  memoryKiB: number;
  passes: number;
  parallelism: number;
  tagLength: number;
  saltLength: number;
}

export const KDF_DEFAULTS: KdfParameters = {
  algorithm: KDF_ALGORITHM,
  memoryKiB: 64 * 1024, // 64 MiB
  passes: 3,
  parallelism: 4,
  tagLength: 32,
  saltLength: 16,
};

export const KDF_MINIMUMS: {
  memoryKiB: number;
  passes: number;
  parallelism: number;
  tagLength: number;
  saltLength: number;
} = {
  memoryKiB: 64 * 1024,
  passes: 3,
  parallelism: 1,
  tagLength: 32,
  saltLength: 16,
};

export const KDF_MAXIMUMS: {
  memoryKiB: number;
  passes: number;
  parallelism: number;
  tagLength: number;
  saltLength: number;
} = {
  memoryKiB: 256 * 1024, // 256 MiB (DoS guard)
  passes: 5,
  parallelism: 4,
  tagLength: 32,
  saltLength: 64,
} as const;

/**
 * Validate KDF parameters.
 *
 * The supplied algorithm is checked before any defaults are applied, so an
 * explicit unsupported value cannot be silently overwritten. Out-of-range
 * values are rejected (never clamped) before Argon2id runs.
 */
export function validateKdfParameters(input: Partial<KdfParameters> | KdfParameters): KdfParameters {
  const suppliedAlgorithm =
    input && Object.prototype.hasOwnProperty.call(input, 'algorithm')
      ? (input as { algorithm?: unknown }).algorithm
      : KDF_DEFAULTS.algorithm;

  if (suppliedAlgorithm !== KDF_ALGORITHM) {
    throw new InvalidParametersError(`unsupported KDF algorithm: ${String(suppliedAlgorithm)}`);
  }

  const merged: KdfParameters = {
    ...KDF_DEFAULTS,
    ...input,
    algorithm: KDF_ALGORITHM,
  };
  if (!Number.isInteger(merged.memoryKiB) || merged.memoryKiB < KDF_MINIMUMS.memoryKiB || merged.memoryKiB > KDF_MAXIMUMS.memoryKiB) {
    throw new InvalidParametersError(`memoryKiB must be an integer in [${KDF_MINIMUMS.memoryKiB}, ${KDF_MAXIMUMS.memoryKiB}]`);
  }
  if (!Number.isInteger(merged.passes) || merged.passes < KDF_MINIMUMS.passes || merged.passes > KDF_MAXIMUMS.passes) {
    throw new InvalidParametersError(`passes must be an integer in [${KDF_MINIMUMS.passes}, ${KDF_MAXIMUMS.passes}]`);
  }
  if (!Number.isInteger(merged.parallelism) || merged.parallelism < KDF_MINIMUMS.parallelism || merged.parallelism > KDF_MAXIMUMS.parallelism) {
    throw new InvalidParametersError(`parallelism must be an integer in [${KDF_MINIMUMS.parallelism}, ${KDF_MAXIMUMS.parallelism}]`);
  }
  if (merged.tagLength !== 32) {
    throw new InvalidParametersError('tagLength must be exactly 32 bytes to match the XChaCha20-Poly1305 key size');
  }
  if (!Number.isInteger(merged.saltLength) || merged.saltLength < KDF_MINIMUMS.saltLength || merged.saltLength > KDF_MAXIMUMS.saltLength) {
    throw new InvalidParametersError(`saltLength must be an integer in [${KDF_MINIMUMS.saltLength}, ${KDF_MAXIMUMS.saltLength}]`);
  }
  return merged;
}