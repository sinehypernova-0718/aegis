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

/**
 * Publish the per-launch token for the local UI.
 *
 * `mode` is a POSIX permission and is only enforced on POSIX platforms. On
 * Windows the effective access is governed entirely by the parent directory's
 * ACL, NOT by `0o600`; the default location lives under the per-user temp
 * directory, but Windows ACL verification for the configured directory remains
 * a deployment prerequisite before the UI reads this file. Do not treat the
 * `mode` argument as a Windows security guarantee.
 */
function writeTokenFile(path: string, token: string): void {
	mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
	// Remove any pre-existing file so `mode` is applied on creation rather than
	// silently inheriting broader permissions from a stale file (POSIX).
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

type RaceResult<T> =
	| { readonly timedOut: true }
	| { readonly timedOut: false; readonly ok: true; readonly value: T }
	| { readonly timedOut: false; readonly ok: false; readonly error: unknown };

/**
 * Race a promise against a deadline without leaking the promise as an unhandled
 * rejection. The observed branch always resolves, so when the deadline wins the
 * original promise is still observed but the caller is free to continue.
 */
function raceWithTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
	label: string,
): Promise<RaceResult<T>> {
	const observed = promise.then<RaceResult<T>, RaceResult<T>>(
		(value) => ({ timedOut: false, ok: true, value }),
		(error: unknown) => ({
			timedOut: false,
			ok: false,
			error: error ?? new Error(`${label} failed`),
		}),
	);
	if (timeoutMs <= 0) return observed;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<RaceResult<T>>((resolve) => {
		timer = setTimeout(() => resolve({ timedOut: true }), timeoutMs);
		if (typeof timer === 'object' && timer !== null && 'unref' in timer) timer.unref();
	});
	return Promise.race([observed, timeout]).finally(() => {
		if (timer !== undefined) clearTimeout(timer);
	});
}

interface HttpDrainOutcome {
	readonly drained: boolean;
	readonly error?: unknown;
}

/**
 * Stop accepting new connections and wait for in-flight requests to finish.
 *
 * A graceful deadline bounds the wait. If it expires we force-close the
 * remaining sockets and await the same `close()` promise again (never a second
 * `close()`), because Fastify resolves `close()` only once in-flight handlers
 * have completed. `drained` is true only when that completion is confirmed;
 * callers must not release resources still reachable by a handler when it is
 * false.
 */
async function drainHttpConnections(
	app: FastifyInstance,
	graceMs: number,
	forceMs: number,
): Promise<HttpDrainOutcome> {
	const closing = app.close();

	const graceful = await raceWithTimeout(closing, graceMs, 'http shutdown');
	if (!graceful.timedOut) {
		// Resolved, or rejected by a close hook: either way the server stopped
		// accepting and in-flight requests are done. Keep the error for reporting.
		return graceful.ok ? { drained: true } : { drained: true, error: graceful.error };
	}

	app.server.closeIdleConnections();
	app.server.closeAllConnections();

	const forced = await raceWithTimeout(closing, forceMs, 'http force shutdown');
	if (forced.timedOut) {
		return {
			drained: false,
			error: new Error('http connections did not drain before the shutdown deadline'),
		};
	}
	return forced.ok ? { drained: true } : { drained: true, error: forced.error };
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

			// 1. Stop accepting connections and confirm in-flight requests have
			//    drained. On a missed deadline we force-close sockets and re-await
			//    the same `close()`; the pool is not released until drain is
			//    confirmed.
			const drain = await drainHttpConnections(
				params.app,
				params.config.shutdownTimeoutMs,
				params.config.shutdownForceTimeoutMs,
			);
			if (drain.error !== undefined) errors.push(drain.error);

			// 2. Block new domain work and wipe key material. `lockAll` drains
			//    in-flight session operations and fails new ones closed, so it is
			//    safe even if HTTP has not fully drained.
			await settle(() => params.container.sessionManager.lockAll(), errors);

			// 3. Invalidate ephemeral authorization/throttle state.
			params.unlockThrottle.reset();

			// 4. Only close the pool once drain is confirmed. `GetVaultStatus` and
			//    `UnlockVault` query the repository outside a session scope, so an
			//    in-flight handler could still use the pool. When drain cannot be
			//    confirmed we leave the pool open and surface the error; the
			//    signal path terminates the process instead.
			if (drain.drained) {
				await settle(() => params.databaseClient.close(), errors);
			} else {
				errors.push(new Error('database pool left open: http connections did not drain'));
			}

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
