import { definePackageConfig } from '../../tsdown.config.base.ts';

export default definePackageConfig({
	dts: {
		sourcemap: true,
		compilerOptions: {
			isolatedDeclarations: false,
			declaration: true,
		},
	},
});
