/**
 * Boundary-level error types. The centralized error handler maps these (and
 * domain errors) to stable HTTP responses; routes never build error bodies.
 */

export class UnauthenticatedError extends Error {
	constructor(message = 'authentication required') {
		super(message);
		this.name = 'UnauthenticatedError';
	}
}

export class ForbiddenError extends Error {
	constructor(message = 'request origin is not allowed') {
		super(message);
		this.name = 'ForbiddenError';
	}
}

export class ThrottledError extends Error {
	readonly retryAfterMs: number;

	constructor(retryAfterMs: number) {
		super('too many failed unlock attempts');
		this.name = 'ThrottledError';
		this.retryAfterMs = Math.max(0, Math.ceil(retryAfterMs));
	}
}
