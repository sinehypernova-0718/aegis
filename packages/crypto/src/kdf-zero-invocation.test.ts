import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('node:crypto', async () => {
	const actual = await vi.importActual<typeof import('node:crypto')>('node:crypto');
	return {
		...actual,
		argon2: vi.fn(() => {
			throw new Error('ARGON2_INVOKED');
		}),
	};
});

import { argon2 } from 'node:crypto';
import { deriveKek } from './kdf/derive-key.js';
import { validateKdfParameters } from './kdf/parameters.js';
import { InvalidParametersError } from './errors.js';

describe('KDF: validation occurs before Argon2', () => {
	beforeEach(() => {
		vi.mocked(argon2).mockClear();
	});

	const validSalt = new Uint8Array(16);

	it('rejects below-minimum memoryKiB without invoking Argon2', async () => {
		await expect(
			deriveKek({
				passphrase: 'pw',
				salt: validSalt,
				params: { memoryKiB: 1024, passes: 3, parallelism: 2, tagLength: 32, saltLength: 16 },
			}),
		).rejects.toThrow(InvalidParametersError);
		expect(argon2).not.toHaveBeenCalled();
	});

	it('rejects above-maximum memoryKiB without invoking Argon2', async () => {
		await expect(
			deriveKek({
				passphrase: 'pw',
				salt: validSalt,
				params: { memoryKiB: 512 * 1024, passes: 3, parallelism: 2, tagLength: 32, saltLength: 16 },
			}),
		).rejects.toThrow(InvalidParametersError);
		expect(argon2).not.toHaveBeenCalled();
	});

	it('rejects below-minimum passes without invoking Argon2', async () => {
		await expect(
			deriveKek({
				passphrase: 'pw',
				salt: validSalt,
				params: { memoryKiB: 65536, passes: 1, parallelism: 2, tagLength: 32, saltLength: 16 },
			}),
		).rejects.toThrow(InvalidParametersError);
		expect(argon2).not.toHaveBeenCalled();
	});

	it('rejects above-maximum passes without invoking Argon2', async () => {
		await expect(
			deriveKek({
				passphrase: 'pw',
				salt: validSalt,
				params: { memoryKiB: 65536, passes: 100, parallelism: 2, tagLength: 32, saltLength: 16 },
			}),
		).rejects.toThrow(InvalidParametersError);
		expect(argon2).not.toHaveBeenCalled();
	});

	it('rejects below-minimum parallelism without invoking Argon2', async () => {
		await expect(
			deriveKek({
				passphrase: 'pw',
				salt: validSalt,
				params: { memoryKiB: 65536, passes: 3, parallelism: 0, tagLength: 32, saltLength: 16 },
			}),
		).rejects.toThrow(InvalidParametersError);
		expect(argon2).not.toHaveBeenCalled();
	});

	it('rejects above-maximum parallelism without invoking Argon2', async () => {
		await expect(
			deriveKek({
				passphrase: 'pw',
				salt: validSalt,
				params: { memoryKiB: 65536, passes: 3, parallelism: 100, tagLength: 32, saltLength: 16 },
			}),
		).rejects.toThrow(InvalidParametersError);
		expect(argon2).not.toHaveBeenCalled();
	});

	it('rejects tagLength 31 without invoking Argon2', async () => {
		await expect(
			deriveKek({
				passphrase: 'pw',
				salt: validSalt,
				params: { memoryKiB: 65536, passes: 3, parallelism: 2, tagLength: 31, saltLength: 16 },
			}),
		).rejects.toThrow(InvalidParametersError);
		expect(argon2).not.toHaveBeenCalled();
	});

	it('rejects tagLength 33 without invoking Argon2', async () => {
		await expect(
			deriveKek({
				passphrase: 'pw',
				salt: validSalt,
				params: { memoryKiB: 65536, passes: 3, parallelism: 2, tagLength: 33, saltLength: 16 },
			}),
		).rejects.toThrow(InvalidParametersError);
		expect(argon2).not.toHaveBeenCalled();
	});

	it('rejects unsupported KDF algorithm without invoking Argon2', () => {
		expect(() => validateKdfParameters({ algorithm: 'scrypt' as unknown as 'argon2id' })).toThrow(
			InvalidParametersError,
		);
		expect(argon2).not.toHaveBeenCalled();
	});
});
