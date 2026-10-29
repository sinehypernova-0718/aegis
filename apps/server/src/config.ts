import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type DatabaseClientConfig, readDatabaseClientConfig } from '@aegis/database';

/** The only supported listener host. Aegis is a local-first application. */
export const LOOPBACK_HOST = '127.0.0.1' as const;

export const DEFAULT_SERVER_PORT = 7_787;
/** The largest credential body is ~140 KiB after JSON escaping; 256 KiB is safe. */
export const DEFAULT_BODY_LIMIT_BYTES = 262_144;
export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;
/** Additional grace period after force-closing sockets, before giving up on drain. */
export const DEFAULT_SHUTDOWN_FORCE_TIMEOUT_MS = 2_000;
export const DEFAULT_READINESS_TIMEOUT_MS = 2_000;
export const DEFAULT_IDLE_TIMEOUT_MS = 300_000;
export const DEFAULT_LOG_LEVEL = 'info' as const;
export const DEFAULT_TOKEN_FILE = join(tmpdir(), 'aegis', 'server.token');

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export interface UnlockThrottleConfig {
	readonly maxFailures: number;
	readonly windowMs: number;
	readonly lockoutMs: number;
}

export const DEFAULT_UNLOCK_THROTTLE: UnlockThrottleConfig = {
	maxFailures: 5,
	windowMs: 60_000,
	lockoutMs: 60_000,
};

export interface ServerConfig {
	readonly host: typeof LOOPBACK_HOST;
	readonly port: number;
	readonly bodyLimitBytes: number;
	readonly shutdownTimeoutMs: number;
	readonly shutdownForceTimeoutMs: number;
	readonly readinessTimeoutMs: number;
	readonly idleTimeoutMs: number;
	/** Explicit bearer token (development/tests). `null` means generate per launch. */
	readonly apiToken: string | null;
	/** Where a generated token is published for the local UI. `null` when a token is supplied. */
	readonly tokenFile: string | null;
	readonly allowedOrigins: readonly string[];
	readonly database: DatabaseClientConfig;
	readonly unlockThrottle: UnlockThrottleConfig;
	readonly logLevel: LogLevel;
}

const SUPPLIED_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,512}$/;

function readInteger(
	env: NodeJS.ProcessEnv,
	name: string,
	fallback: number,
	minimum: number,
	maximum: number,
): number {
	const raw = env[name];
	if (raw === undefined || raw.trim() === '') return fallback;
	const value = Number(raw);
	if (!Number.isInteger(value) || value < minimum || value > maximum) {
		throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
	}
	return value;
}

function readLogLevel(env: NodeJS.ProcessEnv): LogLevel {
	const raw = env.AEGIS_LOG_LEVEL?.trim();
	if (!raw) return DEFAULT_LOG_LEVEL;
	if (!(LOG_LEVELS as readonly string[]).includes(raw)) {
		throw new Error(`AEGIS_LOG_LEVEL must be one of ${LOG_LEVELS.join(', ')}`);
	}
	return raw as LogLevel;
}

function loopbackOrigin(hostname: string, port: number): string {
	return port === 80 ? `http://${hostname}` : `http://${hostname}:${port}`;
}

/**
 * Parse exact extra origins for a development UI. Each entry must be an origin
 * (scheme + host + optional port) with no path, query, or credentials.
 */
function readAllowedOrigins(env: NodeJS.ProcessEnv, port: number): readonly string[] {
	const origins = new Set<string>([
		loopbackOrigin('127.0.0.1', port),
		loopbackOrigin('localhost', port),
	]);
	const raw = env.AEGIS_ALLOWED_ORIGINS?.trim();
	if (!raw) return [...origins];

	for (const entry of raw.split(',')) {
		const candidate = entry.trim();
		if (candidate === '') continue;
		let url: URL;
		try {
			url = new URL(candidate);
		} catch {
			throw new Error(`AEGIS_ALLOWED_ORIGINS contains an invalid origin: ${candidate}`);
		}
		if (url.protocol !== 'http:' && url.protocol !== 'https:') {
			throw new Error(`AEGIS_ALLOWED_ORIGINS must use http or https: ${candidate}`);
		}
		if (
			url.pathname !== '/' ||
			url.search !== '' ||
			url.hash !== '' ||
			url.username !== '' ||
			url.password !== ''
		) {
			throw new Error(`AEGIS_ALLOWED_ORIGINS must contain origins only: ${candidate}`);
		}
		origins.add(url.origin);
	}
	return [...origins];
}

export function readServerConfig(environment: NodeJS.ProcessEnv = process.env): ServerConfig {
	const port = readInteger(environment, 'AEGIS_PORT', DEFAULT_SERVER_PORT, 1, 65_535);
	const suppliedToken = environment.AEGIS_API_TOKEN?.trim();
	if (
		suppliedToken !== undefined &&
		suppliedToken !== '' &&
		!SUPPLIED_TOKEN_PATTERN.test(suppliedToken)
	) {
		throw new Error('AEGIS_API_TOKEN must be 32-512 base64url characters');
	}
	const apiToken = suppliedToken !== undefined && suppliedToken !== '' ? suppliedToken : null;

	const configuredTokenFile = environment.AEGIS_TOKEN_FILE?.trim();
	const tokenFile =
		apiToken !== null
			? null
			: configuredTokenFile !== undefined && configuredTokenFile !== ''
				? configuredTokenFile
				: DEFAULT_TOKEN_FILE;

	return {
		host: LOOPBACK_HOST,
		port,
		bodyLimitBytes: readInteger(
			environment,
			'AEGIS_BODY_LIMIT_BYTES',
			DEFAULT_BODY_LIMIT_BYTES,
			1_024,
			10_485_760,
		),
		shutdownTimeoutMs: readInteger(
			environment,
			'AEGIS_SHUTDOWN_TIMEOUT_MS',
			DEFAULT_SHUTDOWN_TIMEOUT_MS,
			100,
			120_000,
		),
		shutdownForceTimeoutMs: readInteger(
			environment,
			'AEGIS_SHUTDOWN_FORCE_TIMEOUT_MS',
			DEFAULT_SHUTDOWN_FORCE_TIMEOUT_MS,
			100,
			120_000,
		),
		readinessTimeoutMs: readInteger(
			environment,
			'AEGIS_READINESS_TIMEOUT_MS',
			DEFAULT_READINESS_TIMEOUT_MS,
			100,
			30_000,
		),
		idleTimeoutMs: readInteger(
			environment,
			'AEGIS_IDLE_TIMEOUT_MS',
			DEFAULT_IDLE_TIMEOUT_MS,
			0,
			86_400_000,
		),
		apiToken,
		tokenFile,
		allowedOrigins: readAllowedOrigins(environment, port),
		database: readDatabaseClientConfig(environment),
		unlockThrottle: {
			maxFailures: readInteger(environment, 'AEGIS_UNLOCK_MAX_FAILURES', 5, 1, 1_000),
			windowMs: readInteger(environment, 'AEGIS_UNLOCK_WINDOW_MS', 60_000, 1_000, 3_600_000),
			lockoutMs: readInteger(environment, 'AEGIS_UNLOCK_LOCKOUT_MS', 60_000, 1_000, 3_600_000),
		},
		logLevel: readLogLevel(environment),
	};
}
