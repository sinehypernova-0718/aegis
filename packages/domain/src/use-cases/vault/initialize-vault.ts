import type { VaultSession } from '@aegis/crypto';

import {
	InvalidKeyEnvelopeError,
	InvalidVaultInputError,
	PersistenceError,
	VaultAlreadyInitializedError,
} from '../../errors/domain-errors.js';
import { isUniqueViolation } from '../../errors/mapping.js';
import type { Clock, IdGenerator } from '../../ports/runtime.js';
import type { VaultCryptoPort } from '../../ports/vault-crypto.js';
import type { VaultRepositoryPort } from '../../ports/vault-repository.js';
import type { VaultSessionManager } from '../../sessions/vault-session-manager.js';

/**
 * Dispose a session during failure cleanup without masking the primary error.
 * Disposal is best-effort memory hygiene; a secondary failure here must never
 * replace the error that triggered the cleanup.
 */
function disposeQuietly(session: VaultSession): void {
	try {
		session.dispose();
	} catch {
		// Ignore: cleanup is best-effort and must not hide the original failure.
	}
}

export interface InitializeVaultDeps {
	readonly vaultRepository: VaultRepositoryPort;
	readonly sessionManager: VaultSessionManager;
	readonly crypto: VaultCryptoPort;
	readonly clock: Clock;
	readonly ids: IdGenerator;
	readonly keyEnvelopePurpose: string;
	/** Purpose of the recovery-factor envelope persisted alongside the primary one. */
	readonly recoveryKeyEnvelopePurpose: string;
}

export interface InitializeVaultInput {
	readonly passphrase: string;
	readonly vaultId?: string;
}

export interface InitializeVaultResult {
	readonly vaultId: string;
	readonly runtimeState: 'unlocked' | 'locked';
	/**
	 * Emergency recovery key, generated here and returned EXACTLY ONCE. It must
	 * be presented to the user before setup completes; the backend stores no
	 * readable copy of it, only the DEK wrapped under its derived KEK.
	 */
	readonly recoveryKey: string;
}

/**
 * Create a new vault: generate key material + session, atomically persist the
 * vault and its initial envelope, then register the session.
 *
 * Durable initialization and session registration are NOT one transaction. If
 * the database commit succeeds but registration fails, the vault remains durable
 * and recoverable via `UnlockVault`; the use case disposes the new session and
 * returns `runtimeState: 'locked'`. It never reports a live session that was not
 * registered, and never reports success when the durable write failed.
 */
export class InitializeVault {
	readonly #deps: InitializeVaultDeps;

	constructor(deps: InitializeVaultDeps) {
		this.#deps = deps;
	}

	async execute(input: InitializeVaultInput): Promise<InitializeVaultResult> {
		const passphrase = input?.passphrase;
		if (typeof passphrase !== 'string' || passphrase.length === 0) {
			throw new InvalidVaultInputError('passphrase must be a non-empty string');
		}
		const vaultId = input.vaultId ?? this.#deps.ids.generate();
		if (typeof vaultId !== 'string' || vaultId.length === 0) {
			throw new InvalidVaultInputError('vaultId must be a non-empty string');
		}
		if (this.#deps.recoveryKeyEnvelopePurpose === this.#deps.keyEnvelopePurpose) {
			throw new InvalidVaultInputError(
				'primary and recovery envelope purposes must be different strings',
			);
		}

		const recoveryKey = this.#deps.crypto.generateRecoveryKey();
		const created = await this.#deps.crypto.createVaultSession({
			vaultId,
			passphrase,
			recoveryKey,
		});
		if (created.recoveryEnvelope === undefined) {
			// Contract violation by the crypto adapter: without the recovery
			// envelope the returned key could never unlock the vault.
			disposeQuietly(created.session);
			throw new InvalidKeyEnvelopeError('crypto adapter did not produce the recovery envelope');
		}
		// Ownership of the session transfers to the manager only after a successful
		// registration. Until then, every exit path — including failures while
		// generating timestamps, persisting, or registering — disposes it.
		let ownershipTransferred = false;
		try {
			const now = this.#deps.clock.now();

			try {
				await this.#deps.vaultRepository.initializeVaultWithKeyEnvelopes(
					{
						id: vaultId,
						status: 'initialized',
						encryptionFormatVersion: created.envelope.version,
						createdAt: now,
						updatedAt: now,
					},
					[
						{
							id: this.#deps.ids.generate(),
							vaultId,
							purpose: this.#deps.keyEnvelopePurpose,
							envelopeVersion: created.envelope.version,
							envelope: created.envelope,
							createdAt: now,
						},
						{
							id: this.#deps.ids.generate(),
							vaultId,
							purpose: this.#deps.recoveryKeyEnvelopePurpose,
							envelopeVersion: created.recoveryEnvelope.version,
							envelope: created.recoveryEnvelope,
							createdAt: now,
						},
					],
				);
			} catch (error) {
				if (isUniqueViolation(error)) {
					throw new VaultAlreadyInitializedError(`vault ${vaultId} already exists`);
				}
				throw new PersistenceError('failed to persist vault initialization', { cause: error });
			}

			// Durable state is committed. A registration failure must not roll back
			// the vault; it stays recoverable through the normal unlock flow.
			try {
				this.#deps.sessionManager.register(vaultId, created.session);
				ownershipTransferred = true;
			} catch {
				// Registration failed; the finally block disposes the unregistered session.
			}
		} finally {
			if (!ownershipTransferred) disposeQuietly(created.session);
		}

		return {
			vaultId,
			runtimeState: ownershipTransferred ? 'unlocked' : 'locked',
			recoveryKey,
		};
	}
}
