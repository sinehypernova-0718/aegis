import { type Database } from '../client/database.js';

export type DatabaseTransaction = Parameters<Database['transaction']>[0] extends (
	transaction: infer T,
) => unknown
	? T
	: never;

export type TransactionCallback<T> = (database: DatabaseTransaction) => Promise<T>;

export async function withDatabaseTransaction<T>(
	database: Database,
	callback: TransactionCallback<T>,
): Promise<T> {
	return database.transaction(async (transaction) => callback(transaction));
}
