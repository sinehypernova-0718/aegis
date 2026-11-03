import type {
	CreateCredentialInput,
	CredentialCounts,
	CredentialView,
	DeleteCredentialInput,
	DeleteCredentialResult,
	GetCredentialCountsInput,
	GetCredentialInput,
	GetVaultStatusInput,
	GetVaultStatusResult,
	InitializeVaultInput,
	InitializeVaultResult,
	ListCredentialsInput,
	ListCredentialsResult,
	LockVaultInput,
	LockVaultResult,
	RecoverVaultInput,
	RecoverVaultResult,
	UnlockVaultInput,
	UnlockVaultResult,
	UpdateCredentialInput,
	UpdateCredentialResult,
} from '@aegis/domain';

/**
 * Structural view of the composition root used by the HTTP boundary.
 *
 * Declared with explicit use-case signatures (rather than importing concrete
 * classes) so tests can inject deterministic fakes without a database, while
 * `createAegisContainer` remains structurally assignable.
 */
export interface SessionLifecycle {
	lockAll(): Promise<void>;
}

export interface AppContainer {
	readonly initializeVault: {
		execute(input: InitializeVaultInput): Promise<InitializeVaultResult>;
	};
	readonly unlockVault: { execute(input: UnlockVaultInput): Promise<UnlockVaultResult> };
	readonly recoverVault: { execute(input: RecoverVaultInput): Promise<RecoverVaultResult> };
	readonly lockVault: { execute(input: LockVaultInput): Promise<LockVaultResult> };
	readonly getVaultStatus: {
		execute(input: GetVaultStatusInput): Promise<GetVaultStatusResult>;
	};
	readonly getCredentialCounts: {
		execute(input: GetCredentialCountsInput): Promise<CredentialCounts>;
	};
	readonly createCredential: {
		execute(input: CreateCredentialInput): Promise<CredentialView>;
	};
	readonly getCredential: { execute(input: GetCredentialInput): Promise<CredentialView> };
	readonly listCredentials: {
		execute(input: ListCredentialsInput): Promise<ListCredentialsResult>;
	};
	readonly updateCredential: {
		execute(input: UpdateCredentialInput): Promise<UpdateCredentialResult>;
	};
	readonly deleteCredential: {
		execute(input: DeleteCredentialInput): Promise<DeleteCredentialResult>;
	};
	readonly sessionManager: SessionLifecycle;
}
