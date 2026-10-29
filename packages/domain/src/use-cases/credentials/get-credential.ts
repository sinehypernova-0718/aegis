import { parseCredentialPayload } from '../../credentials/credential-payload.js';
import { CredentialNotFoundError, InvalidVaultInputError } from '../../errors/domain-errors.js';
import { asPersistenceError, mapDecryptionError } from '../../errors/mapping.js';
import type { CredentialRecordRow, CredentialRepositoryPort } from '../../ports/credential-repository.js';
import type { VaultSessionManager } from '../../sessions/vault-session-manager.js';
import type { CredentialView } from './credential-view.js';

export interface GetCredentialDeps {
	readonly credentialRepository: CredentialRepositoryPort;
	readonly sessionManager: VaultSessionManager;
}

export interface GetCredentialInput {
	readonly vaultId: string;
	readonly id: string;
}

/** Read one credential by vault + record id, authenticate, decrypt, validate. */
export class GetCredential {
	readonly #deps: GetCredentialDeps;

	constructor(deps: GetCredentialDeps) {
		this.#deps = deps;
	}

	async execute(input: GetCredentialInput): Promise<CredentialView> {
		if (typeof input?.vaultId !== 'string' || input.vaultId.length === 0) {
			throw new InvalidVaultInputError('vaultId must be a non-empty string');
		}
		if (typeof input.id !== 'string' || input.id.length === 0) {
			throw new InvalidVaultInputError('credential id must be a non-empty string');
		}
		const { vaultId, id } = input;

		return this.#deps.sessionManager.run(vaultId, async (session) => {
			let row: CredentialRecordRow | null;
			try {
				row = await this.#deps.credentialRepository.getRecordById(vaultId, id);
			} catch (error) {
				throw asPersistenceError(error, 'failed to read credential');
			}
			if (!row) {
				throw new CredentialNotFoundError(`credential not found: ${id}`);
			}

			let plaintext: Uint8Array;
			try {
				plaintext = session.decryptRecord({
					recordId: row.id,
					encryptionVersion: row.encryptionVersion,
					nonce: row.nonce,
					ciphertext: row.ciphertext,
				});
			} catch (error) {
				throw mapDecryptionError(error);
			}

			const payload = parseCredentialPayload(plaintext);
			return { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt, payload };
		});
	}
}
