import type { FastifyInstance } from 'fastify';
import {
	type ErrorCode,
	type ErrorDetail,
	type ErrorResponse,
	safeMessageForCode,
} from '@aegis/contracts';
import { DomainError } from '@aegis/domain';

import { ForbiddenError, ThrottledError, UnauthenticatedError } from './errors.js';
import { RequestValidationError } from './validation.js';

/**
 * Centralized error-code to HTTP status mapping. Domain errors carry a stable
 * `contractCode`; routes never duplicate this logic.
 */
const STATUS_BY_CODE: Readonly<Record<ErrorCode, number>> = {
	VALIDATION_ERROR: 400,
	UNAUTHENTICATED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	CONFLICT: 409,
	VAULT_LOCKED: 423,
	RATE_LIMITED: 429,
	INTERNAL_ERROR: 500,
};

function errorBody(code: ErrorCode, requestId: string, details?: ErrorDetail[]): ErrorResponse {
	return {
		code,
		message: safeMessageForCode(code),
		requestId,
		...(details !== undefined && details.length > 0 ? { details } : {}),
	};
}

interface MappedError {
	readonly statusCode: number;
	readonly code: ErrorCode;
	readonly details?: ErrorDetail[];
	readonly retryAfterMs?: number;
	readonly serverError: boolean;
}

function fastifyShape(error: unknown): { code?: unknown; statusCode?: unknown } | null {
	if (typeof error !== 'object' || error === null) return null;
	const candidate = error as { code?: unknown; statusCode?: unknown };
	return candidate;
}

function mapError(error: unknown): MappedError {
	if (error instanceof RequestValidationError) {
		return {
			statusCode: 400,
			code: 'VALIDATION_ERROR',
			details: error.details,
			serverError: false,
		};
	}
	if (error instanceof UnauthenticatedError) {
		return { statusCode: 401, code: 'UNAUTHENTICATED', serverError: false };
	}
	if (error instanceof ForbiddenError) {
		return { statusCode: 403, code: 'FORBIDDEN', serverError: false };
	}
	if (error instanceof ThrottledError) {
		return {
			statusCode: 429,
			code: 'RATE_LIMITED',
			retryAfterMs: error.retryAfterMs,
			serverError: false,
		};
	}
	if (error instanceof DomainError) {
		const code = error.contractCode;
		return {
			statusCode: STATUS_BY_CODE[code] ?? 500,
			code,
			serverError: code === 'INTERNAL_ERROR',
		};
	}

	const shape = fastifyShape(error);
	if (shape?.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
		return { statusCode: 413, code: 'VALIDATION_ERROR', serverError: false };
	}
	if (
		shape?.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE' ||
		shape?.code === 'FST_ERR_CTP_EMPTY_JSON_BODY'
	) {
		return { statusCode: 400, code: 'VALIDATION_ERROR', serverError: false };
	}
	if (typeof shape?.statusCode === 'number' && shape.statusCode >= 400 && shape.statusCode < 500) {
		const status = shape.statusCode;
		if (status === 401) return { statusCode: 401, code: 'UNAUTHENTICATED', serverError: false };
		if (status === 403) return { statusCode: 403, code: 'FORBIDDEN', serverError: false };
		if (status === 404) return { statusCode: 404, code: 'NOT_FOUND', serverError: false };
		if (status === 429) return { statusCode: 429, code: 'RATE_LIMITED', serverError: false };
		return { statusCode: status, code: 'VALIDATION_ERROR', serverError: false };
	}

	return { statusCode: 500, code: 'INTERNAL_ERROR', serverError: true };
}

function errorName(error: unknown): string {
	return typeof error === 'object' &&
		error !== null &&
		typeof (error as { name?: unknown }).name === 'string'
		? (error as { name: string }).name
		: 'Error';
}

function errorCode(error: unknown): string | undefined {
	return typeof error === 'object' &&
		error !== null &&
		typeof (error as { code?: unknown }).code === 'string'
		? (error as { code: string }).code
		: undefined;
}

function errorStack(error: unknown): string | undefined {
	return error instanceof Error ? error.stack : undefined;
}

export function registerErrorHandler(app: FastifyInstance): void {
	app.setErrorHandler((error, request, reply) => {
		const mapped = mapError(error);
		if (mapped.serverError) {
			// Log names/codes/stack only: never the request body (passphrases and
			// secrets), and never adapter `cause` objects (SQL/connection details).
			request.log.error(
				{
					errorName: errorName(error),
					errorCode: errorCode(error),
					stack: errorStack(error),
				},
				'request failed',
			);
		}
		if (mapped.retryAfterMs !== undefined) {
			reply.header('retry-after', String(Math.max(1, Math.ceil(mapped.retryAfterMs / 1000))));
		}
		void reply.code(mapped.statusCode).send(errorBody(mapped.code, request.id, mapped.details));
	});
}

export function registerNotFoundHandler(app: FastifyInstance): void {
	app.setNotFoundHandler((request, reply) => {
		void reply.code(404).send(errorBody('NOT_FOUND', request.id));
	});
}
