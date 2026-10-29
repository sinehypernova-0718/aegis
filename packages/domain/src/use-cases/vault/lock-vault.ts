import { InvalidVaultInputError } from '../../errors/domain-errors.js';
import type { VaultSessionManager } from '../../sessions/vault-session-manager.js';

export interface LockVaultDeps {
	readonly sessionManager: VaultSessionManager;
}

export interface LockVaultInput {
	readonly vaultId: string;
}

export interface LockVaultResult {
	readonly vaultId: string;
	readonly status: 'locked';
}

/** Lock a vault: block new operations, drain in-flight work, dispose the session. */
export class LockVault {
	readonly #deps: LockVaultDeps;

	constructor(deps: LockVaultDeps) {
		this.#deps = deps;
	}

	async execute(input: LockVaultInput): Promise<LockVaultResult> {
		if (typeof input?.vaultId !== 'string' || input.vaultId.length === 0) {
			throw new InvalidVaultInputError('vaultId must be a non-empty string');
		}
		await this.#deps.sessionManager.lock(input.vaultId);
		return { vaultId: input.vaultId, status: 'locked' };
	}
}
