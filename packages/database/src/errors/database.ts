import { RecordNotFoundError, UniqueConstraintViolationError } from './repository.js';

export class DatabaseError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'DatabaseError';
	}
}

export interface PostgresErrorLike {
	code?: string;
	constraint?: string;
	detail?: string;
	message?: string;
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
	const pgError = asPostgresError(error);
	if (pgError?.code === '23505') {
		return new UniqueConstraintViolationError(
			pgError.constraint
				? `unique constraint violation: ${pgError.constraint}`
				: 'unique constraint violation',
		);
	}
	if (pgError?.code === '23503') {
		return new DatabaseError('foreign key constraint violation');
	}
	if (error instanceof Error) return error;
	return new DatabaseError('database operation failed');
}
