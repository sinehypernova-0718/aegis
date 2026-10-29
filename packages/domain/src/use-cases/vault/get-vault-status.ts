import { InvalidVaultInputError } from '../../errors/domain-errors.js';
import type { VaultRepositoryPort } from '../../ports/vault-repository.js';
import type { VaultSessionManager } from '../../sessions/vault-session-manager.js';

export interface GetVaultStatusDeps {
	readonly vaultRepository: VaultRepositoryPort;
	readonly sessionManager: VaultSessionManager;
}

export interface GetVaultStatusInput {
	readonly vaultId: string;
}

export type VaultStatus = 'uninitialized' | 'locked' | 'unlocked';

export interface GetVaultStatusResult {
	readonly status: VaultStatus;
	readonly vaultId: string | null;
}

/**
 * Report durable vault existence separately from process-local session state.
 * A durable vault with no live session is the normal locked-after-restart state.
 */
export class GetVaultStatus {
	readonly #deps: GetVaultStatusDeps;

	constructor(deps: GetVaultStatusDeps) {
		this.#deps = deps;
	}

	async execute(input: GetVaultStatusInput): Promise<GetVaultStatusResult> {
		if (typeof input?.vaultId !== 'string' || input.vaultId.length === 0) {
			throw new InvalidVaultInputError('vaultId must be a non-empty string');
		}
		const vault = await this.#deps.vaultRepository.getVaultById(input.vaultId);
		if (!vault) {
			return { status: 'uninitialized', vaultId: null };
		}
		return {
			status: this.#deps.sessionManager.isUnlocked(vault.id) ? 'unlocked' : 'locked',
			vaultId: vault.id,
		};
	}
}
