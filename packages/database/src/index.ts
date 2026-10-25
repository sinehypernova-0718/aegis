export const packageName = '@aegis/database' as const;

export type { DatabaseClientConfig } from './client/config.js';
export { readDatabaseClientConfig } from './client/config.js';
export type { Database, DatabaseClient } from './client/database.js';
export { createDatabaseClient } from './client/database.js';
export { DatabaseError, mapDatabaseError } from './errors/database.js';
export { RecordNotFoundError, UniqueConstraintViolationError } from './errors/repository.js';
export type { VaultRecord, VaultRecordRepository } from './repositories/vault-records.js';
export { DrizzleVaultRecordRepository } from './repositories/vault-records.js';
export type {
	CreateVaultInput,
	CreateVaultKeyEnvelopeInput,
	VaultRepository,
} from './repositories/vaults.js';
export { DrizzleVaultRepository } from './repositories/vaults.js';
export * from './schema/index.js';
export type { TransactionCallback } from './transactions/index.js';
export { withDatabaseTransaction } from './transactions/index.js';
