import type { FastifyInstance } from 'fastify';
import type { DatabaseClient } from '@aegis/database';
import {
	CredentialNotFoundError,
	type CredentialPayload,
	type CredentialPayloadInput,
	type CredentialView,
	UnlockRejectedError,
} from '@aegis/domain';

import { LOOPBACK_HOST, type ServerConfig } from '../config.js';
import type { AppContainer } from '../http/dependencies.js';

/** Deterministic test token (>= 32 characters). */
export const TEST_API_TOKEN = 'test-token-0123456789abcdef0123456789abcdef';
export const TEST_VAULT_ID = '00000000-0000-4000-8000-000000000001';
export const TEST_CORRECT_PASSPHRASE = 'correct horse battery staple';
export const TEST_SECRET_MARKER = 'TEST_SECRET_MARKER_7c91';
export const TEST_NOTE_MARKER = 'TEST_PRIVATE_NOTE_MARKER_4d28';
export const TEST_WRONG_PASSPHRASE = 'wrong passphrase';

const CREATED_AT = '2026-01-01T00:00:00.000Z';
const UPDATED_AT = '2026-01-02T00:00:00.000Z';

export const CREDENTIAL_ID = '00000000-0000-4000-8000-000000000002';

export interface FakeContainerState {
	vaultId: string | null;
	unlocked: boolean;
	readonly credentials: Map<string, CredentialView>;
	lockAllCalls: number;
	readonly calls: {
		initialize: number;
		unlock: number;
		lock: number;
		status: number;
		create: number;
		get: number;
		list: number;
		update: number;
		delete: number;
	};
}

export interface FakeContainer {
	readonly container: AppContainer;
	readonly state: FakeContainerState;
}

function toPayload(input: CredentialPayloadInput): CredentialPayload {
	return {
		schemaVersion: 1,
		type: input.type,
		name: input.name,
		secret: input.secret,
		tags: input.tags !== undefined ? [...input.tags] : [],
		...(input.username !== undefined ? { username: input.username } : {}),
		...(input.url !== undefined ? { url: input.url } : {}),
		...(input.notes !== undefined ? { notes: input.notes } : {}),
		...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
	};
}

/**
 * Stateful in-memory composition root used by HTTP boundary tests. It mirrors
 * the real use-case contracts without touching crypto or PostgreSQL.
 */
export function createFakeContainer(): FakeContainer {
	const state: FakeContainerState = {
		vaultId: null,
		unlocked: false,
		credentials: new Map(),
		lockAllCalls: 0,
		calls: {
			initialize: 0,
			unlock: 0,
			lock: 0,
			status: 0,
			create: 0,
			get: 0,
			list: 0,
			update: 0,
			delete: 0,
		},
	};

	const container: AppContainer = {
		initializeVault: {
			async execute(input) {
				state.calls.initialize += 1;
				state.vaultId = input.vaultId ?? TEST_VAULT_ID;
				state.unlocked = true;
				return { vaultId: state.vaultId, runtimeState: 'unlocked' };
			},
		},
		unlockVault: {
			async execute(input) {
				state.calls.unlock += 1;
				if (input.passphrase !== TEST_CORRECT_PASSPHRASE) {
					throw new UnlockRejectedError();
				}
				const vaultId = state.vaultId ?? input.vaultId;
				state.vaultId = vaultId;
				state.unlocked = true;
				return { vaultId, status: 'unlocked' };
			},
		},
		lockVault: {
			async execute(input) {
				state.calls.lock += 1;
				state.unlocked = false;
				return { vaultId: input.vaultId, status: 'locked' };
			},
		},
		getVaultStatus: {
			async execute(input) {
				state.calls.status += 1;
				if (state.vaultId === null) return { status: 'uninitialized', vaultId: null };
				return {
					status: state.unlocked ? 'unlocked' : 'locked',
					vaultId: input.vaultId,
				};
			},
		},
		createCredential: {
			async execute(input) {
				state.calls.create += 1;
				const view: CredentialView = {
					id: CREDENTIAL_ID,
					createdAt: CREATED_AT,
					updatedAt: CREATED_AT,
					payload: toPayload(input.payload),
				};
				state.credentials.set(view.id, view);
				return view;
			},
		},
		getCredential: {
			async execute(input) {
				state.calls.get += 1;
				const view = state.credentials.get(input.id);
				if (!view) throw new CredentialNotFoundError();
				return view;
			},
		},
		listCredentials: {
			async execute() {
				state.calls.list += 1;
				return { items: [...state.credentials.values()], nextCursor: null };
			},
		},
		updateCredential: {
			async execute(input) {
				state.calls.update += 1;
				const existing = state.credentials.get(input.id);
				if (!existing) throw new CredentialNotFoundError();
				const payload = toPayload(input.payload);
				state.credentials.set(input.id, {
					id: input.id,
					createdAt: existing.createdAt,
					updatedAt: UPDATED_AT,
					payload,
				});
				return { id: input.id, updatedAt: UPDATED_AT, payload };
			},
		},
		deleteCredential: {
			async execute(input) {
				state.calls.delete += 1;
				if (!state.credentials.delete(input.id)) throw new CredentialNotFoundError();
				return { id: input.id, deleted: true };
			},
		},
		sessionManager: {
			async lockAll() {
				state.lockAllCalls += 1;
				state.unlocked = false;
			},
		},
	};

	return { container, state };
}

export interface FakeDatabaseCalls {
	close: number;
	ping: number;
}

export interface FakeDatabaseClient {
	readonly client: DatabaseClient;
	readonly calls: FakeDatabaseCalls;
}

/**
 * Minimal `DatabaseClient` double. The `database`/`pool` members are never used
 * when `createContainer` is also replaced in tests.
 */
export function createFakeDatabaseClient(): FakeDatabaseClient {
	const calls: FakeDatabaseCalls = { close: 0, ping: 0 };
	const client: DatabaseClient = {
		database: {} as DatabaseClient['database'],
		pool: {} as DatabaseClient['pool'],
		ping: async () => {
			calls.ping += 1;
		},
		close: async () => {
			calls.close += 1;
		},
	};
	return { client, calls };
}

export interface FakeAppHooks {
	onClose?: () => void;
	onForceClose?: () => void;
	closeError?: Error;
	listenError?: Error;
	/**
	 * When provided, `close()` awaits this promise before resolving, so a test
	 * can model HTTP drain that only completes after connections are force-closed.
	 */
	closePromise?: Promise<void>;
}

export interface FakeApp {
	readonly app: FastifyInstance;
	readonly calls: { close: number; listen: number; forceClose: number };
}

/**
 * Minimal Fastify double for lifecycle tests. Only `close`, `listen`, and the
 * server connection-closing hooks are exercised; the cast is confined to tests.
 */
export function createFakeApp(hooks: FakeAppHooks = {}): FakeApp {
	const calls = { close: 0, listen: 0, forceClose: 0 };
	const app = {
		close: async () => {
			calls.close += 1;
			hooks.onClose?.();
			if (hooks.closePromise) await hooks.closePromise;
			if (hooks.closeError) throw hooks.closeError;
		},
		listen: async () => {
			calls.listen += 1;
			if (hooks.listenError) throw hooks.listenError;
			return 'http://127.0.0.1:7787';
		},
		server: {
			closeIdleConnections: () => {},
			closeAllConnections: () => {
				calls.forceClose += 1;
				hooks.onForceClose?.();
			},
		},
		log: { error: () => {}, info: () => {}, warn: () => {} },
	} as unknown as FastifyInstance;
	return { app, calls };
}

export function createTestServerConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
	return {
		host: LOOPBACK_HOST,
		port: 7_787,
		bodyLimitBytes: 4_096,
		shutdownTimeoutMs: 2_000,
		shutdownForceTimeoutMs: 2_000,
		readinessTimeoutMs: 1_000,
		idleTimeoutMs: 300_000,
		apiToken: TEST_API_TOKEN,
		tokenFile: null,
		allowedOrigins: ['http://127.0.0.1:7787', 'http://localhost:7787'],
		database: { connectionString: 'postgres://test' },
		unlockThrottle: { maxFailures: 5, windowMs: 60_000, lockoutMs: 60_000 },
		logLevel: 'silent',
		...overrides,
	};
}
