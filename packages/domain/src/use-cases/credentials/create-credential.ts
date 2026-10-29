import type { EncryptedRecord } from '@aegis/crypto';

import { ENCRYPTED_RECORD_TYPE } from '../../credentials/credential-kind.js';
import {
	type CredentialPayloadInput,
	serializeCredentialPayload,
	validateCredentialPayload,
} from '../../credentials/credential-payload.js';
import { asPersistenceError, mapRecordEncryptionError } from '../../errors/mapping.js';
import type { CredentialRepositoryPort } from '../../ports/credential-repository.js';
import type { Clock, IdGenerator } from '../../ports/runtime.js';
import type { VaultSessionManager } from '../../sessions/vault-session-manager.js';
import type { CredentialView } from './credential-view.js';

export interface CreateCredentialDeps {
	readonly credentialRepository: CredentialRepositoryPort;
	readonly sessionManager: VaultSessionManager;
	readonly clock: Clock;
	readonly ids: IdGenerator;
}

export interface CreateCredentialInput {
	readonly vaultId: string;
	readonly payload: CredentialPayloadInput;
}

/**
 * Create a credential: validate + canonicalize the full payload, encrypt it with
 * the vault session (fresh nonce, AAD bound to vault/record/version), then
 * persist only ciphertext + structural fields. Success requires the write.
 */
export class CreateCredential {
	readonly #deps: CreateCredentialDeps;

	constructor(deps: CreateCredentialDeps) {
		this.#deps = deps;
	}

	async execute(input: CreateCredentialInput): Promise<CredentialView> {
		return this.#deps.sessionManager.run(input.vaultId, async (session) => {
			const payload = validateCredentialPayload(input.payload);
			const plaintext = serializeCredentialPayload(payload);
			const recordId = this.#deps.ids.generate();
			const now = this.#deps.clock.now();

			let encrypted: EncryptedRecord;
			try {
				encrypted = session.encryptRecord({ recordId, plaintext });
			} catch (error) {
				throw mapRecordEncryptionError(error);
			}

			try {
				const row = await this.#deps.credentialRepository.createRecord({
					id: recordId,
					vaultId: input.vaultId,
					recordType: ENCRYPTED_RECORD_TYPE,
					encryptionVersion: encrypted.encryptionVersion,
					nonce: encrypted.nonce,
					ciphertext: encrypted.ciphertext,
					createdAt: now,
					updatedAt: now,
					deletedAt: null,
				});
				return { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt, payload };
			} catch (error) {
				throw asPersistenceError(error, 'failed to create credential');
			}
		});
	}
}
