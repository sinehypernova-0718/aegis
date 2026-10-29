import { CredentialNotFoundError, InvalidVaultInputError } from '../../errors/domain-errors.js';
import { asPersistenceError } from '../../errors/mapping.js';
import type { CredentialRepositoryPort } from '../../ports/credential-repository.js';
import type { VaultSessionManager } from '../../sessions/vault-session-manager.js';

export interface DeleteCredentialDeps {
	readonly credentialRepository: CredentialRepositoryPort;
	readonly sessionManager: VaultSessionManager;
}

export interface DeleteCredentialInput {
	readonly vaultId: string;
	readonly id: string;
}

export interface DeleteCredentialResult {
	readonly id: string;
	readonly deleted: true;
}

/** Physically delete a vault-scoped credential. Requires an unlocked vault. */
export class DeleteCredential {
	readonly #deps: DeleteCredentialDeps;

	constructor(deps: DeleteCredentialDeps) {
		this.#deps = deps;
	}

	async execute(input: DeleteCredentialInput): Promise<DeleteCredentialResult> {
		if (typeof input?.vaultId !== 'string' || input.vaultId.length === 0) {
			throw new InvalidVaultInputError('vaultId must be a non-empty string');
		}
		if (typeof input.id !== 'string' || input.id.length === 0) {
			throw new InvalidVaultInputError('credential id must be a non-empty string');
		}
		const { vaultId, id } = input;

		return this.#deps.sessionManager.run(vaultId, async () => {
			let deleted: boolean;
			try {
				deleted = await this.#deps.credentialRepository.deleteRecord(vaultId, id);
			} catch (error) {
				throw asPersistenceError(error, 'failed to delete credential');
			}
			if (!deleted) {
				throw new CredentialNotFoundError(`credential not found: ${id}`);
			}
			return { id, deleted: true };
		});
	}
}
