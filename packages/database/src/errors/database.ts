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
	if (typeof candidate.code !== 'string' && typeof candidate.message !== 'string') return null;
	return {
		code: typeof candidate.code === 'string' ? candidate.code : undefined,
		constraint: typeof candidate.constraint === 'string' ? candidate.constraint : undefined,
		detail: typeof candidate.detail === 'string' ? candidate.detail : undefined,
		message: typeof candidate.message === 'string' ? candidate.message : undefined,
	} as PostgresErrorLike;
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
	// Preserve the original cause for debugging without leaking raw SQL/connection details.
	return new DatabaseError('database operation failed', { cause: error });
}
