import { describe, expect, it } from 'vitest';

import { mapDatabaseError, UniqueConstraintViolationError } from '../src/index.js';

describe('error mapping', () => {
	it('maps PostgreSQL unique violation to a stable error', () => {
		const mapped = mapDatabaseError({ code: '23505', constraint: 'vaults_pkey' });
		expect(mapped).toBeInstanceOf(UniqueConstraintViolationError);
	});
});
