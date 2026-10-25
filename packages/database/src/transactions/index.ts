import { type Database } from '../client/database.js';

export type TransactionCallback<T> = (database: Database) => Promise<T>;

export async function withDatabaseTransaction<T>(
	database: Database,
	callback: TransactionCallback<T>,
): Promise<T> {
	return database.transaction(async (transaction) => callback(transaction as unknown as Database));
}
