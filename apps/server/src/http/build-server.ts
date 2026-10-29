import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { REQUEST_ID_MAX_LENGTH } from '@aegis/contracts';

import { DEFAULT_UNLOCK_THROTTLE, type LogLevel } from '../config.js';
import { BearerTokenAuthenticator, UnlockThrottle } from './auth.js';
import type { AppContainer } from './dependencies.js';
import { registerErrorHandler, registerNotFoundHandler } from './error-handler.js';
import { UnauthenticatedError } from './errors.js';
import { registerCredentialRoutes } from './routes/credentials.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerVaultRoutes, type AuthenticateHandler } from './routes/vaults.js';
import { registerSecurityHeaders, registerSecurityHooks } from './security.js';

export interface BuildServerOptions {
	readonly container: AppContainer;
	readonly apiToken: string;
	readonly port: number;
	readonly bodyLimitBytes: number;
	readonly logLevel: LogLevel;
	readonly checkReadiness: () => Promise<void>;
	readonly unlockThrottle?: UnlockThrottle;
	readonly allowedOrigins?: readonly string[];
	readonly logger?: FastifyServerOptions['logger'];
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

function safeRequestId(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	if (value.length === 0 || value.length > REQUEST_ID_MAX_LENGTH) return null;
	return REQUEST_ID_PATTERN.test(value) ? value : null;
}

function defaultAllowedOrigins(port: number): string[] {
	const suffix = port === 80 ? '' : `:${port}`;
	return [`http://127.0.0.1${suffix}`, `http://localhost${suffix}`];
}

interface PinoRedactionOptions {
	readonly level: LogLevel;
	readonly redact: {
		readonly paths: string[];
		readonly censor: string;
	};
}

function defaultLogger(logLevel: LogLevel): PinoRedactionOptions {
	return {
		level: logLevel,
		redact: {
			paths: [
				'req.headers.authorization',
				'req.headers.cookie',
				'req.body.passphrase',
				'req.body.payload.secret',
				'req.body.payload.notes',
				'res.headers["set-cookie"]',
			],
			censor: '[REDACTED]',
		},
	};
}

/**
 * Build the Fastify application without binding a socket. Tests drive it with
 * `app.inject()`; production startup lives in `lifecycle.ts`.
 */
export function buildServer(options: BuildServerOptions): FastifyInstance {
	const app = Fastify({
		logger: options.logger ?? defaultLogger(options.logLevel),
		bodyLimit: options.bodyLimitBytes,
		// Always run our own bounded id validation; Fastify's built-in header
		// pass-through would accept arbitrary unbounded values.
		requestIdHeader: false,
		genReqId: (request) => safeRequestId(request.headers['x-request-id']) ?? randomUUID(),
		trustProxy: false,
		forceCloseConnections: 'idle',
	});

	registerSecurityHeaders(app);
	registerSecurityHooks(app, {
		port: options.port,
		allowedOrigins: options.allowedOrigins ?? defaultAllowedOrigins(options.port),
	});
	registerErrorHandler(app);
	registerNotFoundHandler(app);

	const authenticator = new BearerTokenAuthenticator(options.apiToken);
	const authenticateHandler: AuthenticateHandler = async (request) => {
		if (!authenticator.verify(request.headers.authorization)) {
			throw new UnauthenticatedError();
		}
	};

	const unlockThrottle = options.unlockThrottle ?? new UnlockThrottle(DEFAULT_UNLOCK_THROTTLE);

	registerHealthRoutes(app, { checkReadiness: options.checkReadiness });
	registerVaultRoutes(app, {
		container: options.container,
		authenticate: authenticateHandler,
		unlockThrottle,
	});
	registerCredentialRoutes(app, {
		container: options.container,
		authenticate: authenticateHandler,
	});

	return app;
}
