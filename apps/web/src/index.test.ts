import { describe, expect, it } from 'vitest';

import { packageName } from './index.js';

describe('@aegis/web', () => {
	it('loads application entry point', () => {
		expect(packageName).toBe('@aegis/web');
	});
});
