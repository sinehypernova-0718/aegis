import { type Database, DrizzleVaultRepository } from '@aegis/database';
import {
	type Clock,
	CreateCredential,
	DefaultVaultSessionManager,
	DeleteCredential,
	GetCredential,
	GetCredentialCounts,
	GetVaultStatus,
	type IdGenerator,
	InitializeVault,
	ListCredentials,
	LockVault,
	RecoverVault,
	UnlockVault,
	UpdateCredential,
} from '@aegis/domain';

import { createCredentialRepositoryPort } from './credential-repository-port.js';
import { createCryptoVaultPort } from './crypto-vault-port.js';

/** Canonical purpose for the vault's active key envelope. */
export const PRIMARY_KEY_ENVELOPE_PURPOSE = 'primary' as const;

/** Canonical purpose for the recovery-factor envelope (passphrase emergency unlock). */
export const RECOVERY_KEY_ENVELOPE_PURPOSE = 'recovery' as const;

export interface AegisContainerOptions {
	readonly database: Database;
	readonly clock: Clock;
	readonly ids: IdGenerator;
	readonly keyEnvelopePurpose?: string;
	readonly recoveryKeyEnvelopePurpose?: string;
	/** Inactivity window before an unlocked vault is locked automatically. */
	readonly idleTimeoutMs?: number;
}

/** Composition root: concrete repositories + crypto adapter + session manager. */
export interface AegisContainer {
	readonly initializeVault: InitializeVault;
	readonly unlockVault: UnlockVault;
	readonly recoverVault: RecoverVault;
	readonly lockVault: LockVault;
	readonly getVaultStatus: GetVaultStatus;
	readonly getCredentialCounts: GetCredentialCounts;
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
	const sessionManager = new DefaultVaultSessionManager(
		options.idleTimeoutMs !== undefined ? { idleTimeoutMs: options.idleTimeoutMs } : {},
	);
	const listCredentials = new ListCredentials({ credentialRepository, sessionManager });
	const keyEnvelopePurpose = options.keyEnvelopePurpose ?? PRIMARY_KEY_ENVELOPE_PURPOSE;
	const recoveryKeyEnvelopePurpose =
		options.recoveryKeyEnvelopePurpose ?? RECOVERY_KEY_ENVELOPE_PURPOSE;

	return {
		sessionManager,
		initializeVault: new InitializeVault({
			vaultRepository,
			sessionManager,
			crypto,
			clock: options.clock,
			ids: options.ids,
			keyEnvelopePurpose,
			recoveryKeyEnvelopePurpose,
		}),
		unlockVault: new UnlockVault({ vaultRepository, sessionManager, crypto, keyEnvelopePurpose }),
		recoverVault: new RecoverVault({
			vaultRepository,
			sessionManager,
			crypto,
			recoveryKeyEnvelopePurpose,
		}),
		lockVault: new LockVault({ sessionManager }),
		getVaultStatus: new GetVaultStatus({ vaultRepository, sessionManager }),
		getCredentialCounts: new GetCredentialCounts({ listCredentials }),
		createCredential: new CreateCredential({
			credentialRepository,
			sessionManager,
			clock: options.clock,
			ids: options.ids,
		}),
		getCredential: new GetCredential({ credentialRepository, sessionManager }),
		listCredentials,
		updateCredential: new UpdateCredential({
			credentialRepository,
			sessionManager,
			clock: options.clock,
		}),
		deleteCredential: new DeleteCredential({ credentialRepository, sessionManager }),
	};
}
