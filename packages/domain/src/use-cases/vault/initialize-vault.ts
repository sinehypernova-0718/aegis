import {
	InvalidVaultInputError,
	PersistenceError,
	VaultAlreadyInitializedError,
} from '../../errors/domain-errors.js';
import { isUniqueViolation } from '../../errors/mapping.js';
import type { Clock, IdGenerator } from '../../ports/runtime.js';
import type { VaultCryptoPort } from '../../ports/vault-crypto.js';
import type { VaultRepositoryPort } from '../../ports/vault-repository.js';
import type { VaultSessionManager } from '../../sessions/vault-session-manager.js';

export interface InitializeVaultDeps {
	readonly vaultRepository: VaultRepositoryPort;
	readonly sessionManager: VaultSessionManager;
	readonly crypto: VaultCryptoPort;
	readonly clock: Clock;
	readonly ids: IdGenerator;
	readonly keyEnvelopePurpose: string;
}

export interface InitializeVaultInput {
	readonly passphrase: string;
	readonly vaultId?: string;
}

export interface InitializeVaultResult {
	readonly vaultId: string;
	readonly runtimeState: 'unlocked' | 'locked';
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

		const created = await this.#deps.crypto.createVaultSession({ vaultId, passphrase });
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
				],
			);
		} catch (error) {
			created.session.dispose();
			if (isUniqueViolation(error)) {
				throw new VaultAlreadyInitializedError(`vault ${vaultId} already exists`);
			}
			throw new PersistenceError('failed to persist vault initialization', { cause: error });
		}

		// Durable state committed. Registration failure must not roll back.
		try {
			this.#deps.sessionManager.register(vaultId, created.session);
		} catch {
			created.session.dispose();
			return { vaultId, runtimeState: 'locked' };
		}
		return { vaultId, runtimeState: 'unlocked' };
	}
}
