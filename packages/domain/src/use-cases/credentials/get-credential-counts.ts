import { InvalidVaultInputError } from '../../errors/domain-errors.js';
import type { ListCredentials } from './list-credentials.js';

export interface CredentialCounts {
	readonly credentialCount: number;
	readonly passwordCount: number;
	readonly apiKeyCount: number;
	readonly tokenCount: number;
	readonly sshKeyCount: number;
	readonly oauth2Count: number;
	readonly secureNoteCount: number;
}

export interface GetCredentialCountsInput {
	readonly vaultId: string;
}

/**
 * Computes dashboard aggregates without retaining a vault-wide credential list.
 * Credential kinds live inside encrypted payloads, so each bounded page is
 * decrypted by ListCredentials and counted before the next page is requested.
 */
export class GetCredentialCounts {
	readonly #listCredentials: ListCredentials;

	constructor(deps: { readonly listCredentials: ListCredentials }) {
		this.#listCredentials = deps.listCredentials;
	}

	async execute(input: GetCredentialCountsInput): Promise<CredentialCounts> {
		if (typeof input?.vaultId !== 'string' || input.vaultId.length === 0) {
			throw new InvalidVaultInputError('vaultId must be a non-empty string');
		}

		const counts = {
			credentialCount: 0,
			passwordCount: 0,
			apiKeyCount: 0,
			tokenCount: 0,
			sshKeyCount: 0,
			oauth2Count: 0,
			secureNoteCount: 0,
		};
		let cursor: string | null = null;

		do {
			const page = await this.#listCredentials.execute({
				vaultId: input.vaultId,
				limit: 100,
				...(cursor !== null ? { cursor } : {}),
			});
			for (const item of page.items) {
				counts.credentialCount += 1;
				switch (item.payload.type) {
					case 'password':
						counts.passwordCount += 1;
						break;
					case 'api_key':
						counts.apiKeyCount += 1;
						break;
					case 'access_token':
					case 'refresh_token':
						counts.apiKeyCount += 1;
						counts.tokenCount += 1;
						break;
					case 'ssh_key':
						counts.sshKeyCount += 1;
						break;
					case 'oauth2':
						counts.oauth2Count += 1;
						break;
					case 'secure_note':
					case 'certificate':
					case 'recovery_code':
						counts.secureNoteCount += 1;
						break;
				}
			}
			cursor = page.nextCursor;
		} while (cursor !== null);

		return counts;
	}
}
