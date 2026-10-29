// Opaque vault session.
//
// The session owns the unwrapped DEK in a true private field (`#dek`). It is not
// serializable: `JSON.stringify(session)` yields `{}`, and there is no `toJSON`.
// Callers can encrypt/decrypt records and dispose the session; they can never
// read the key bytes.
import { clean } from '@noble/ciphers/utils';

import { SessionDisposedError, UnsupportedVersionError } from '../errors.js';
import { DEK_LENGTH } from '../keys/generate-dek.js';
import {
	type EncryptedRecord,
	RECORD_ENCRYPTION_VERSION,
	decryptRecord,
	encryptRecord,
} from '../records/record-encryption.js';

export interface EncryptRecordInput {
	readonly recordId: string;
	readonly plaintext: Uint8Array;
}

export interface DecryptRecordInput {
	readonly recordId: string;
	readonly encryptionVersion: number;
	readonly nonce: Uint8Array;
	readonly ciphertext: Uint8Array;
}

export interface VaultSession {
	readonly vaultId: string;
	readonly isDisposed: boolean;
	encryptRecord(input: EncryptRecordInput): EncryptedRecord;
	decryptRecord(input: DecryptRecordInput): Uint8Array;
	/**
	 * Best-effort key wipe. This is memory hygiene, NOT a guarantee that every
	 * copy has been erased from V8, native code, or garbage-collected memory.
	 * Idempotent.
	 */
	dispose(): void;
}

/**
 * Concrete session. Internal to the package: only the `VaultSession` interface
 * is re-exported from the public entry point.
 */
export class DefaultVaultSession implements VaultSession {
	readonly #vaultId: string;
	#dek: Uint8Array | null;

	constructor(vaultId: string, dek: Uint8Array) {
		if (typeof vaultId !== 'string' || vaultId.length === 0) {
			throw new TypeError('session vaultId must be a non-empty string');
		}
		if (!(dek instanceof Uint8Array) || dek.length !== DEK_LENGTH) {
			throw new TypeError(`session DEK must be ${DEK_LENGTH} bytes`);
		}
		this.#vaultId = vaultId;
		// Copy so the caller's buffer can be wiped independently.
		this.#dek = dek.slice();
	}

	get vaultId(): string {
		return this.#vaultId;
	}

	get isDisposed(): boolean {
		return this.#dek === null;
	}

	encryptRecord(input: EncryptRecordInput): EncryptedRecord {
		const dek = this.#requireDek();
		if (typeof input?.recordId !== 'string' || input.recordId.length === 0) {
			throw new TypeError('recordId must be a non-empty string');
		}
		return encryptRecord(
			dek,
			{
				vaultId: this.#vaultId,
				recordId: input.recordId,
				encryptionVersion: RECORD_ENCRYPTION_VERSION,
			},
			input.plaintext,
		);
	}

	decryptRecord(input: DecryptRecordInput): Uint8Array {
		const dek = this.#requireDek();
		if (input?.encryptionVersion !== RECORD_ENCRYPTION_VERSION) {
			throw new UnsupportedVersionError(
				`unsupported record encryption version: ${String(input?.encryptionVersion)}`,
			);
		}
		return decryptRecord(dek, {
			context: {
				vaultId: this.#vaultId,
				recordId: input.recordId,
				encryptionVersion: input.encryptionVersion,
			},
			nonce: input.nonce,
			ciphertext: input.ciphertext,
		});
	}

	dispose(): void {
		if (this.#dek) {
			clean(this.#dek);
			this.#dek = null;
		}
	}

	#requireDek(): Uint8Array {
		if (this.#dek === null) {
			throw new SessionDisposedError();
		}
		return this.#dek;
	}
}
