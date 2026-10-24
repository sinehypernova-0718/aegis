import { describe, expect, it } from 'vitest';

import { packageName } from './index.js';

describe('@aegis/database', () => {
	it('loads package entry point', () => {
		expect(packageName).toBe('@aegis/database');
	});
});
