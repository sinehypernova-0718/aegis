import { describe, expect, it } from 'vitest';

import { packageName } from './index.js';

describe('@aegis/domain', () => {
	it('loads package entry point', () => {
		expect(packageName).toBe('@aegis/domain');
	});
});
