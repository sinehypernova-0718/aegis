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

export interface RecoverVaultDeps {
	readonly vaultRepository: VaultRepositoryPort;
	readonly sessionManager: VaultSessionManager;
	readonly crypto: VaultCryptoPort;
	readonly recoveryKeyEnvelopePurpose: string;
}

export interface RecoverVaultInput {
	readonly vaultId: string;
	readonly recoveryKey: string;
}

export interface RecoverVaultResult {
	readonly vaultId: string;
	readonly status: 'unlocked';
}

/**
 * Emergency recovery: unlock a locked vault from its `recovery`-purpose key
 * envelope when the master passphrase is lost.
 *
 * The recovery key is re-derived into a KEK (Argon2id, own salt + params stored
 * in the envelope) and must unwrap the same DEK the primary passphrase wraps.
 * The envelope is validated structurally BEFORE any KDF work; a wrong key
 * surfaces as the same opaque `UnlockRejectedError` as a wrong passphrase. No
 * failure path leaves a partially registered session.
 */
export class RecoverVault {
	readonly #deps: RecoverVaultDeps;

	constructor(deps: RecoverVaultDeps) {
		this.#deps = deps;
	}

	async execute(input: RecoverVaultInput): Promise<RecoverVaultResult> {
		if (typeof input?.vaultId !== 'string' || input.vaultId.length === 0) {
			throw new InvalidVaultInputError('vaultId must be a non-empty string');
		}
		if (typeof input.recoveryKey !== 'string' || input.recoveryKey.length === 0) {
			throw new InvalidVaultInputError('recoveryKey must be a non-empty string');
		}
		const { vaultId, recoveryKey } = input;

		const vault = await this.#deps.vaultRepository.getVaultById(vaultId);
		if (!vault) {
			throw new VaultNotFoundError(`vault not found: ${vaultId}`);
		}
		if (this.#deps.sessionManager.isUnlocked(vaultId)) {
			throw new VaultAlreadyUnlockedError(`vault ${vaultId} is already unlocked`);
		}

		const envelopeRow = await this.#deps.vaultRepository.getActiveKeyEnvelope(
			vaultId,
			this.#deps.recoveryKeyEnvelopePurpose,
		);
		if (!envelopeRow) {
			// Vaults created before recovery envelopes existed (or with recovery
			// disabled) cannot be recovered — fail without exposing why.
			throw new InvalidKeyEnvelopeError('no active recovery envelope exists for this vault');
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
				passphrase: recoveryKey,
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
