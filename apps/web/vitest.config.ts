import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vitest/config';
import base from '../../vitest.base.ts';

export default mergeConfig(base, {
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
	test: {
		name: '@aegis/web',
	},
});
