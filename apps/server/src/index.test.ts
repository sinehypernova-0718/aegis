import { describe, expect, it } from 'vitest';

import { packageName } from './index.js';

describe('@aegis/server', () => {
	it('loads application entry point', () => {
		expect(packageName).toBe('@aegis/server');
	});
});
