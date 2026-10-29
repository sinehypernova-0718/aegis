import { DrizzleVaultRepository, type Database } from '@aegis/database';
import {
	type Clock,
	CreateCredential,
	DefaultVaultSessionManager,
	DeleteCredential,
	GetCredential,
	GetVaultStatus,
	type IdGenerator,
	InitializeVault,
	ListCredentials,
	LockVault,
	UnlockVault,
	UpdateCredential,
} from '@aegis/domain';

import { createCryptoVaultPort } from './crypto-vault-port.js';
import { createCredentialRepositoryPort } from './credential-repository-port.js';

/** Canonical purpose for the vault's active key envelope. */
export const PRIMARY_KEY_ENVELOPE_PURPOSE = 'primary' as const;

export interface AegisContainerOptions {
	readonly database: Database;
	readonly clock: Clock;
	readonly ids: IdGenerator;
	readonly keyEnvelopePurpose?: string;
}

/** Composition root: concrete repositories + crypto adapter + session manager. */
export interface AegisContainer {
	readonly initializeVault: InitializeVault;
	readonly unlockVault: UnlockVault;
	readonly lockVault: LockVault;
	readonly getVaultStatus: GetVaultStatus;
	readonly createCredential: CreateCredential;
	readonly getCredential: GetCredential;
	readonly listCredentials: ListCredentials;
	readonly updateCredential: UpdateCredential;
	readonly deleteCredential: DeleteCredential;
	readonly sessionManager: DefaultVaultSessionManager;
}

/**
 * Wire the object graph. Concrete Drizzle repositories satisfy the domain ports
 * structurally; no database types leak into the domain package.
 */
export function createAegisContainer(options: AegisContainerOptions): AegisContainer {
	const vaultRepository = new DrizzleVaultRepository(options.database);
	const credentialRepository = createCredentialRepositoryPort(options.database);
	const crypto = createCryptoVaultPort();
	const sessionManager = new DefaultVaultSessionManager();
	const keyEnvelopePurpose = options.keyEnvelopePurpose ?? PRIMARY_KEY_ENVELOPE_PURPOSE;

	return {
		sessionManager,
		initializeVault: new InitializeVault({
			vaultRepository,
			sessionManager,
			crypto,
			clock: options.clock,
			ids: options.ids,
			keyEnvelopePurpose,
		}),
		unlockVault: new UnlockVault({ vaultRepository, sessionManager, crypto, keyEnvelopePurpose }),
		lockVault: new LockVault({ sessionManager }),
		getVaultStatus: new GetVaultStatus({ vaultRepository, sessionManager }),
		createCredential: new CreateCredential({
			credentialRepository,
			sessionManager,
			clock: options.clock,
			ids: options.ids,
		}),
		getCredential: new GetCredential({ credentialRepository, sessionManager }),
		listCredentials: new ListCredentials({ credentialRepository, sessionManager }),
		updateCredential: new UpdateCredential({
			credentialRepository,
			sessionManager,
			clock: options.clock,
		}),
		deleteCredential: new DeleteCredential({ credentialRepository, sessionManager }),
	};
}
