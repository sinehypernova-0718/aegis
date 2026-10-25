export interface DatabaseClientConfig {
	connectionString: string;
	maxConnections?: number;
	idleTimeoutMillis?: number;
	connectionTimeoutMillis?: number;
}

function validateNumber(value: number, name: string, minimum: number, maximum: number): void {
	if (!Number.isFinite(value)) {
		throw new Error(`${name} must be a finite number`);
	}
	if (value < minimum || value > maximum) {
		throw new Error(`${name} must be between ${minimum} and ${maximum}`);
	}
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
		const value = Number(environment.DATABASE_POOL_MAX);
		validateNumber(value, 'DATABASE_POOL_MAX', 1, 1000);
		config.maxConnections = value;
	}
	if (environment.DATABASE_IDLE_TIMEOUT_MS !== undefined) {
		const value = Number(environment.DATABASE_IDLE_TIMEOUT_MS);
		validateNumber(value, 'DATABASE_IDLE_TIMEOUT_MS', 1000, 600000);
		config.idleTimeoutMillis = value;
	}
	if (environment.DATABASE_CONNECT_TIMEOUT_MS !== undefined) {
		const value = Number(environment.DATABASE_CONNECT_TIMEOUT_MS);
		validateNumber(value, 'DATABASE_CONNECT_TIMEOUT_MS', 1000, 60000);
		config.connectionTimeoutMillis = value;
	}

	return config;
}
