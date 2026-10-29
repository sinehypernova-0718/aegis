import { PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT } from '@aegis/contracts';

import {
	decodeCredentialCursor,
	encodeCredentialCursor,
} from '../../credentials/credential-cursor.js';
import { parseCredentialPayload } from '../../credentials/credential-payload.js';
import { InvalidPaginationError, InvalidVaultInputError } from '../../errors/domain-errors.js';
import { asPersistenceError, mapDecryptionError } from '../../errors/mapping.js';
import type {
	CredentialRecordRow,
	CredentialRepositoryPort,
} from '../../ports/credential-repository.js';
import type { VaultSessionManager } from '../../sessions/vault-session-manager.js';
import type { CredentialView } from './credential-view.js';

export interface ListCredentialsDeps {
	readonly credentialRepository: CredentialRepositoryPort;
	readonly sessionManager: VaultSessionManager;
}

export interface ListCredentialsInput {
	readonly vaultId: string;
	readonly limit?: number;
	readonly cursor?: string | null;
}

export interface ListCredentialsResult {
	readonly items: CredentialView[];
	readonly nextCursor: string | null;
}

function resolveLimit(limit: number | undefined): number {
	if (limit === undefined) return PAGINATION_DEFAULT_LIMIT;
	if (!Number.isInteger(limit) || limit < 1 || limit > PAGINATION_MAX_LIMIT) {
		throw new InvalidPaginationError(`limit must be an integer in [1, ${PAGINATION_MAX_LIMIT}]`);
	}
	return limit;
}

/**
 * List a bounded, deterministically ordered page of credentials for an unlocked
 * vault. Listing is all-or-nothing: if any record is malformed or fails
 * authentication, the whole page fails (no silent omission).
 */
export class ListCredentials {
	readonly #deps: ListCredentialsDeps;

	constructor(deps: ListCredentialsDeps) {
		this.#deps = deps;
	}

	async execute(input: ListCredentialsInput): Promise<ListCredentialsResult> {
		if (typeof input?.vaultId !== 'string' || input.vaultId.length === 0) {
			throw new InvalidVaultInputError('vaultId must be a non-empty string');
		}
		const { vaultId } = input;
		const limit = resolveLimit(input.limit);
		const after =
			input.cursor === undefined || input.cursor === null
				? undefined
				: decodeCredentialCursor(input.cursor);

		return this.#deps.sessionManager.run(vaultId, async (session) => {
			let rows: CredentialRecordRow[];
			try {
				rows = await this.#deps.credentialRepository.listRecordsByVault(vaultId, {
					limit: limit + 1,
					after,
				});
			} catch (error) {
				throw asPersistenceError(error, 'failed to list credentials');
			}

			const hasMore = rows.length > limit;
			const page = hasMore ? rows.slice(0, limit) : rows;
			const items: CredentialView[] = page.map((row) => {
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

			const last = page[page.length - 1];
			const nextCursor =
				hasMore && last ? encodeCredentialCursor({ createdAt: last.createdAt, id: last.id }) : null;
			return { items, nextCursor };
		});
	}
}
