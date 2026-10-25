export interface DatabaseClientConfig {
	connectionString: string;
	maxConnections?: number;
	idleTimeoutMillis?: number;
	connectionTimeoutMillis?: number;
}

export function readDatabaseClientConfig(
	environment: NodeJS.ProcessEnv = process.env,
): DatabaseClientConfig {
	const connectionString = environment.DATABASE_URL ?? environment.AEGIS_DATABASE_URL;
	if (typeof connectionString !== 'string' || connectionString.trim() === '') {
		throw new Error('DATABASE_URL or AEGIS_DATABASE_URL is required');
	}

	const config: DatabaseClientConfig = {
		connectionString: connectionString.trim(),
	};

	if (environment.DATABASE_POOL_MAX !== undefined) {
		config.maxConnections = Number(environment.DATABASE_POOL_MAX);
	}
	if (environment.DATABASE_IDLE_TIMEOUT_MS !== undefined) {
		config.idleTimeoutMillis = Number(environment.DATABASE_IDLE_TIMEOUT_MS);
	}
	if (environment.DATABASE_CONNECT_TIMEOUT_MS !== undefined) {
		config.connectionTimeoutMillis = Number(environment.DATABASE_CONNECT_TIMEOUT_MS);
	}

	return config;
}
