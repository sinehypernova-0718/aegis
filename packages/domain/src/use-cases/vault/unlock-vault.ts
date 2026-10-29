import type { VaultSession } from '@aegis/crypto';

import {
	InvalidKeyEnvelopeError,
	InvalidVaultInputError,
	VaultAlreadyUnlockedError,
	VaultNotFoundError,
} from '../../errors/domain-errors.js';
import { mapEnvelopeValidationError, mapUnlockError } from '../../errors/mapping.js';
import type { VaultCryptoPort } from '../../ports/vault-crypto.js';
import type { VaultRepositoryPort } from '../../ports/vault-repository.js';
import type { VaultSessionManager } from '../../sessions/vault-session-manager.js';

export interface UnlockVaultDeps {
	readonly vaultRepository: VaultRepositoryPort;
	readonly sessionManager: VaultSessionManager;
	readonly crypto: VaultCryptoPort;
	readonly keyEnvelopePurpose: string;
}

export interface UnlockVaultInput {
	readonly vaultId: string;
	readonly passphrase: string;
}

export interface UnlockVaultResult {
	readonly vaultId: string;
	readonly status: 'unlocked';
}

/**
 * Unlock a vault from its persisted, eligible key envelope.
 *
 * The envelope is validated structurally BEFORE any Argon2id work. A session is
 * registered only after all validation and cryptographic steps succeed; no
 * failure path leaves a partially registered session.
 */
export class UnlockVault {
	readonly #deps: UnlockVaultDeps;

	constructor(deps: UnlockVaultDeps) {
		this.#deps = deps;
	}

	async execute(input: UnlockVaultInput): Promise<UnlockVaultResult> {
		if (typeof input?.vaultId !== 'string' || input.vaultId.length === 0) {
			throw new InvalidVaultInputError('vaultId must be a non-empty string');
		}
		if (typeof input.passphrase !== 'string' || input.passphrase.length === 0) {
			throw new InvalidVaultInputError('passphrase must be a non-empty string');
		}
		const { vaultId, passphrase } = input;

		const vault = await this.#deps.vaultRepository.getVaultById(vaultId);
		if (!vault) {
			throw new VaultNotFoundError(`vault not found: ${vaultId}`);
		}
		if (this.#deps.sessionManager.isUnlocked(vaultId)) {
			throw new VaultAlreadyUnlockedError(`vault ${vaultId} is already unlocked`);
		}

		const envelopeRow = await this.#deps.vaultRepository.getActiveKeyEnvelope(
			vaultId,
			this.#deps.keyEnvelopePurpose,
		);
		if (!envelopeRow) {
			throw new InvalidKeyEnvelopeError('no active key envelope is available for this vault');
		}

		// Cheap structural/version validation before expensive KDF work.
		try {
			this.#deps.crypto.validateEnvelope(envelopeRow.envelope);
		} catch (error) {
			throw mapEnvelopeValidationError(error);
		}

		let session: VaultSession;
		try {
			session = await this.#deps.crypto.unlockVaultSession({
				vaultId,
				passphrase,
				envelope: envelopeRow.envelope,
			});
		} catch (error) {
			throw mapUnlockError(error);
		}

		if (this.#deps.sessionManager.isUnlocked(vaultId)) {
			session.dispose();
			throw new VaultAlreadyUnlockedError(`vault ${vaultId} is already unlocked`);
		}
		try {
			this.#deps.sessionManager.register(vaultId, session);
		} catch (error) {
			session.dispose();
			throw error;
		}
		return { vaultId, status: 'unlocked' };
	}
}
