import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { FastifyInstance, FastifyServerOptions } from 'fastify';
import {
	type DatabaseClient,
	type DatabaseClientConfig,
	createDatabaseClient,
} from '@aegis/database';

import { createAegisContainer, type AegisContainerOptions } from './composition/aegis-container.js';
import { systemClock, uuidGenerator } from './composition/runtime.js';
import { LOOPBACK_HOST, readServerConfig, type ServerConfig } from './config.js';
import { createApiToken, UnlockThrottle } from './http/auth.js';
import { buildServer, type BuildServerOptions } from './http/build-server.js';
import type { AppContainer } from './http/dependencies.js';

export interface RuntimeFactories {
	readonly createDatabaseClient: (config: DatabaseClientConfig) => DatabaseClient;
	readonly createContainer: (options: AegisContainerOptions) => AppContainer;
	readonly buildApplication: (options: BuildServerOptions) => FastifyInstance;
}

export interface CreateRuntimeOptions {
	readonly config: ServerConfig;
	readonly logger?: FastifyServerOptions['logger'];
	/** Test seam: replace one or more resource factories. */
	readonly factories?: Partial<RuntimeFactories>;
}

export interface AegisRuntime {
	readonly config: ServerConfig;
	readonly databaseClient: DatabaseClient;
	readonly container: AppContainer;
	readonly app: FastifyInstance;
	readonly apiToken: string;
	readonly tokenFile: string | null;
	readonly unlockThrottle: UnlockThrottle;
	/** Idempotent, best-effort shutdown. */
	shutdown(): Promise<void>;
}

export interface StartServerOptions extends CreateRuntimeOptions {
	/**
	 * Install SIGINT/SIGTERM handlers. Defaults to `false` so tests and repeated
	 * factory construction never add duplicate process listeners.
	 */
	readonly installSignalHandlers?: boolean;
}

export interface RunningServer extends AegisRuntime {
	readonly address: string;
}

function writeTokenFile(path: string, token: string): void {
	mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
	// Remove any pre-existing file so `mode` is applied on creation rather than
	// silently inheriting broader permissions from a stale file.
	rmSync(path, { force: true });
	writeFileSync(path, token, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
}

function removeTokenFile(path: string): void {
	rmSync(path, { force: true });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
	if (timeoutMs <= 0) return promise;
	return new Promise<T>((resolve, reject) => {
		const handle = setTimeout(() => {
			reject(new Error(`${label} timed out after ${timeoutMs}ms`));
		}, timeoutMs);
		handle.unref();
		promise.then(
			(value) => {
				clearTimeout(handle);
				resolve(value);
			},
			(error: unknown) => {
				clearTimeout(handle);
				reject(error);
			},
		);
	});
}

async function settle(action: () => Promise<unknown>, errors: unknown[]): Promise<void> {
	try {
		await action();
	} catch (error) {
		errors.push(error);
	}
}

function createReadinessCheck(ping: () => Promise<void>, timeoutMs: number): () => Promise<void> {
	return () => withTimeout(ping(), timeoutMs, 'database readiness');
}

function createShutdown(params: {
	readonly config: ServerConfig;
	readonly app: FastifyInstance;
	readonly container: AppContainer;
	readonly databaseClient: DatabaseClient;
	readonly unlockThrottle: UnlockThrottle;
	readonly tokenFile: string | null;
}): () => Promise<void> {
	let shutdownPromise: Promise<void> | null = null;

	return () => {
		shutdownPromise ??= (async () => {
			const errors: unknown[] = [];

			// 1. Stop accepting connections and drain/reject outstanding requests.
			//    `app.close()` waits for in-flight handlers, which in turn await
			//    their domain operations, so the session drain below is normally a
			//    no-op. The timeout bounds a stuck connection.
			await settle(
				() => withTimeout(params.app.close(), params.config.shutdownTimeoutMs, 'http shutdown'),
				errors,
			);

			// 2. Lock and dispose every vault session (wipes DEK material).
			await settle(() => params.container.sessionManager.lockAll(), errors);

			// 3. Invalidate ephemeral authorization/throttle state.
			params.unlockThrottle.reset();

			// 4. Close the database pool last, once no domain work can use it.
			await settle(() => params.databaseClient.close(), errors);

			// 5. Remove the per-launch token handoff file.
			if (params.tokenFile !== null) {
				try {
					removeTokenFile(params.tokenFile);
				} catch (error) {
					errors.push(error);
				}
			}

			if (errors.length > 0) throw errors[0];
		})();
		return shutdownPromise;
	};
}

/**
 * Create the process runtime: database client, domain container, Fastify app.
 * Does not bind a socket. On any failure, resources already created are closed
 * and the original error is rethrown.
 */
export async function createRuntime(options: CreateRuntimeOptions): Promise<AegisRuntime> {
	const config = options.config;
	const factories: RuntimeFactories = {
		createDatabaseClient,
		createContainer: createAegisContainer,
		buildApplication: buildServer,
		...options.factories,
	};

	let databaseClient: DatabaseClient | null = null;
	let tokenFile: string | null = null;

	try {
		databaseClient = factories.createDatabaseClient(config.database);
		const client = databaseClient;

		const container = factories.createContainer({
			database: client.database,
			clock: systemClock,
			ids: uuidGenerator,
			idleTimeoutMs: config.idleTimeoutMs,
		});

		const apiToken = config.apiToken ?? createApiToken();
		tokenFile = config.apiToken === null ? config.tokenFile : null;
		if (tokenFile !== null) writeTokenFile(tokenFile, apiToken);

		const unlockThrottle = new UnlockThrottle(config.unlockThrottle);
		const checkReadiness = createReadinessCheck(() => client.ping(), config.readinessTimeoutMs);

		const app = factories.buildApplication({
			container,
			apiToken,
			port: config.port,
			bodyLimitBytes: config.bodyLimitBytes,
			logLevel: config.logLevel,
			checkReadiness,
			unlockThrottle,
			allowedOrigins: config.allowedOrigins,
			...(options.logger !== undefined ? { logger: options.logger } : {}),
		});

		return {
			config,
			databaseClient: client,
			container,
			app,
			apiToken,
			tokenFile,
			unlockThrottle,
			shutdown: createShutdown({
				config,
				app,
				container,
				databaseClient: client,
				unlockThrottle,
				tokenFile,
			}),
		};
	} catch (error) {
		if (tokenFile !== null) {
			try {
				removeTokenFile(tokenFile);
			} catch {
				// Best-effort cleanup; preserve the startup error.
			}
		}
		if (databaseClient !== null) {
			await databaseClient.close().catch(() => {
				// Best-effort cleanup; preserve the startup error.
			});
		}
		throw error;
	}
}

/**
 * Build the runtime and bind the listener on loopback only.
 *
 * `installSignalHandlers` defaults to false; `main()` opts in exactly once.
 */
export async function startServer(options: StartServerOptions): Promise<RunningServer> {
	const runtime = await createRuntime(options);
	try {
		const address = await runtime.app.listen({
			host: LOOPBACK_HOST,
			port: runtime.config.port,
		});
		if (options.installSignalHandlers === true) installShutdownSignals(runtime);
		return { ...runtime, address };
	} catch (error) {
		await runtime.shutdown().catch(() => {
			// Best-effort cleanup; preserve the bind error.
		});
		throw error;
	}
}

let signalsInstalled = false;

function installShutdownSignals(runtime: AegisRuntime): void {
	if (signalsInstalled) return;
	signalsInstalled = true;

	const handle = (signal: NodeJS.Signals): void => {
		void runtime
			.shutdown()
			.then(() => {
				process.exit(0);
			})
			.catch((error: unknown) => {
				runtime.app.log.error(
					{ signal, errorName: error instanceof Error ? error.name : 'Error' },
					'shutdown failed',
				);
				process.exit(1);
			});
	};

	process.once('SIGINT', handle);
	process.once('SIGTERM', handle);
}

/** Production entry point. Never logs the API token or request bodies. */
export async function main(): Promise<void> {
	try {
		const config = readServerConfig();
		const runtime = await startServer({ config, installSignalHandlers: true });
		runtime.app.log.info({ address: runtime.address }, 'aegis server listening');
	} catch (error) {
		const message = error instanceof Error ? error.message : 'unknown error';
		process.stderr.write(`aegis server failed to start: ${message}\n`);
		process.exitCode = 1;
	}
}
