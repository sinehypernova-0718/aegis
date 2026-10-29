import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../schema/index.js';
import type { DatabaseClientConfig } from './config.js';

export type Database = ReturnType<typeof drizzle<typeof schema>>;

export interface DatabaseClient {
	database: Database;
	pool: Pool;
	/** Minimal connectivity check used by readiness probes. */
	ping(): Promise<void>;
	close(): Promise<void>;
}

export function createDatabaseClient(config: DatabaseClientConfig): DatabaseClient {
	const pool = new Pool({
		connectionString: config.connectionString,
		max: config.maxConnections,
		idleTimeoutMillis: config.idleTimeoutMillis,
		connectionTimeoutMillis: config.connectionTimeoutMillis,
	});
	const database = drizzle(pool, { schema });

	return {
		database,
		pool,
		ping: async () => {
			await pool.query('select 1');
		},
		close: async () => {
			await pool.end();
		},
	};
}
