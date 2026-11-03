import {
	type CredentialPayload,
	type CredentialPayloadInput,
	serializeCredentialPayload,
	validateCredentialPayload,
} from '../../credentials/credential-payload.js';
import { ENCRYPTED_RECORD_TYPE } from '../../credentials/credential-kind.js';
import { CredentialNotFoundError, InvalidVaultInputError } from '../../errors/domain-errors.js';
import {
	asPersistenceError,
	isRecordNotFound,
	mapRecordEncryptionError,
} from '../../errors/mapping.js';
import type { CredentialRepositoryPort } from '../../ports/credential-repository.js';
import type { Clock } from '../../ports/runtime.js';
import type { EncryptedRecord } from '../../ports/vault-crypto.js';
import type { VaultSessionManager } from '../../sessions/vault-session-manager.js';

export interface UpdateCredentialDeps {
	readonly credentialRepository: CredentialRepositoryPort;
	readonly sessionManager: VaultSessionManager;
	readonly clock: Clock;
}

export interface UpdateCredentialInput {
	readonly vaultId: string;
	readonly id: string;
	readonly payload: CredentialPayloadInput;
}

export interface UpdateCredentialResult {
	readonly id: string;
	readonly updatedAt: string;
	readonly payload: CredentialPayload;
}

/**
 * Replace a credential's payload. Concurrency policy: last write wins (no
 * optimistic version check in this milestone). Re-encrypts with a fresh nonce
 * and the same record identity/AAD scheme.
 */
export class UpdateCredential {
	readonly #deps: UpdateCredentialDeps;

	constructor(deps: UpdateCredentialDeps) {
		this.#deps = deps;
	}

	async execute(input: UpdateCredentialInput): Promise<UpdateCredentialResult> {
		if (typeof input?.vaultId !== 'string' || input.vaultId.length === 0) {
			throw new InvalidVaultInputError('vaultId must be a non-empty string');
		}
		if (typeof input.id !== 'string' || input.id.length === 0) {
			throw new InvalidVaultInputError('credential id must be a non-empty string');
		}
		const { vaultId, id } = input;

		return this.#deps.sessionManager.run(vaultId, async (session) => {
			const payload = validateCredentialPayload(input.payload);
			const plaintext = serializeCredentialPayload(payload);

			let encrypted: EncryptedRecord;
			try {
				encrypted = session.encryptRecord({ recordId: id, plaintext });
			} catch (error) {
				throw mapRecordEncryptionError(error);
			}

			const updatedAt = this.#deps.clock.now();
			try {
				const updated = await this.#deps.credentialRepository.updateRecord({
					id,
					vaultId,
					recordType: ENCRYPTED_RECORD_TYPE,
					encryptionVersion: encrypted.encryptionVersion,
					nonce: encrypted.nonce,
					ciphertext: encrypted.ciphertext,
					createdAt: updatedAt,
					updatedAt,
					deletedAt: null,
				});
				return { id: updated.id, updatedAt: updated.updatedAt, payload };
			} catch (error) {
				if (isRecordNotFound(error)) {
					throw new CredentialNotFoundError(`credential not found: ${id}`);
				}
				throw asPersistenceError(error, 'failed to update credential');
			}
		});
	}
}
