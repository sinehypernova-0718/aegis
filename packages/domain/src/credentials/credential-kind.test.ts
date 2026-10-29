import { describe, expect, it } from 'vitest';
import { CONTRACT_CREDENTIAL_KINDS } from '@aegis/contracts';

import { CREDENTIAL_KINDS } from './credential-kind.js';

describe('credential kind contract parity', () => {
	it('keeps the contracts and domain kind lists aligned', () => {
		expect([...CREDENTIAL_KINDS]).toEqual([...CONTRACT_CREDENTIAL_KINDS]);
	});
});
