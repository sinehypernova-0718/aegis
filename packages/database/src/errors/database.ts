import { RecordNotFoundError, UniqueConstraintViolationError } from './repository.js';

export class DatabaseError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'DatabaseError';
	}
}

export interface PostgresErrorLike {
	code?: string | undefined;
	constraint?: string | undefined;
	detail?: string | undefined;
	message?: string | undefined;
}

export function asPostgresError(error: unknown): PostgresErrorLike | null {
	if (typeof error !== 'object' || error === null) return null;
	const candidate = error as Record<string, unknown>;

	// Check the error itself first
	const code = typeof candidate.code === 'string' ? candidate.code : undefined;
	const constraint = typeof candidate.constraint === 'string' ? candidate.constraint : undefined;
	const detail = typeof candidate.detail === 'string' ? candidate.detail : undefined;
	const message = typeof candidate.message === 'string' ? candidate.message : undefined;

	// If we found a code, return it
	if (code) {
		return { code, constraint, detail, message };
	}

	// Otherwise, check the cause chain (e.g., DrizzleQueryError wraps pg error in cause)
	const cause = candidate.cause;
	if (typeof cause === 'object' && cause !== null) {
		return asPostgresError(cause);
	}

	// If no code found but has message, return what we have
	if (message) {
		return { code: undefined, constraint, detail, message };
	}

	return null;
}

export function mapDatabaseError(error: unknown): Error {
	const postgresError = asPostgresError(error);
	if (postgresError?.code === '23505') {
		return new UniqueConstraintViolationError(
			postgresError.constraint
				? `unique constraint violation: ${postgresError.constraint}`
				: 'unique constraint violation',
		);
	}
	if (postgresError?.code === '23503') {
		return new DatabaseError('foreign key constraint violation');
	}
	if (error instanceof RecordNotFoundError) return error;
	if (error instanceof UniqueConstraintViolationError) return error;
	if (error instanceof DatabaseError) return error;
	// Retain the underlying error as `cause` for internal diagnostics. That cause
	// can contain SQL text, constraint names, or connection details, so it must
	// never be serialized into API responses or written to unsafe logs.
	return new DatabaseError('database operation failed', { cause: error });
}
