import { randomBytes } from 'node:crypto';

export const DEK_LENGTH = 32;

export function generateDek(): Uint8Array {
	return new Uint8Array(randomBytes(DEK_LENGTH));
}
