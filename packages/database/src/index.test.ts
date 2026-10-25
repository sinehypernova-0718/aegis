import { describe, expect, it } from 'vitest';

import {
	createDatabaseClient,
	readDatabaseClientConfig,
	vaultRecords,
	vaults,
} from '../src/index.js';

describe('@aegis/database config', () => {
	it('requires a database url', () => {
		expect(() => readDatabaseClientConfig({})).toThrow(/DATABASE_URL/);
	});

	it('reads a configured connection string', () => {
		const config = readDatabaseClientConfig({ DATABASE_URL: 'postgres://localhost/aegis' });
		expect(config.connectionString).toBe('postgres://localhost/aegis');
	});
});

describe('@aegis/database client', () => {
	it('creates and closes a client without network initialization', async () => {
		const client = createDatabaseClient({ connectionString: 'postgres://localhost/aegis' });
		await client.close();
		expect(client.database).toBeDefined();
	});
});

describe('@aegis/database schema', () => {
	it('exports typed table accessors', () => {
		expect(vaults).toBeDefined();
		expect(vaultRecords).toBeDefined();
	});
});
