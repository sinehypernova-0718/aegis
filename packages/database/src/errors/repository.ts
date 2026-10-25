export class RecordNotFoundError extends Error {
	constructor(message = 'record not found') {
		super(message);
		this.name = 'RecordNotFoundError';
	}
}

export class UniqueConstraintViolationError extends Error {
	constructor(message = 'unique constraint violation') {
		super(message);
		this.name = 'UniqueConstraintViolationError';
	}
}
