import { mergeConfig } from 'vitest/config';
import base from '../../vitest.base.ts';

export default mergeConfig(base, {
	test: {
		name: '@aegis/server',
		// Argon2id-backed integration tests are intentionally slow; unit tests
		// remain fast. Individual integration cases may set a larger timeout.
		testTimeout: 30_000,
		hookTimeout: 30_000,
	},
});
