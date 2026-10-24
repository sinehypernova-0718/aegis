import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type UserConfig } from 'tsdown';

function deriveEntries(packageDir: string): Record<string, string> {
	const pkgPath = resolve(packageDir, 'package.json');
	const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
		exports?: Record<string, unknown>;
	};

	if (!pkg.exports) {
		throw new Error(
			`Package at ${packageDir} is missing an "exports" field. ` +
				`Add one before configuring tsdown.`,
		);
	}

	const entries: Record<string, string> = {};
	const distRoot = resolve(packageDir, 'dist');

	for (const [key, value] of Object.entries(pkg.exports)) {
		if (typeof value !== 'object' || value === null) {
			continue;
		}

		const cond = value as Record<string, string>;
		const runtimeTarget = cond.import ?? cond.require ?? cond.default;
		if (!runtimeTarget) {
			continue;
		}

		const stripped = runtimeTarget.replace(/^\.\/dist/, '');
		const resolved = resolve(distRoot, `.${stripped}`);
		if (!resolved.startsWith(distRoot)) {
			continue;
		}

		const withoutLeadingDot = key === '.' ? '' : key.replace(/^\.\//, '');
		const srcEntry =
			withoutLeadingDot === '' ? './src/index.ts' : `./src/${withoutLeadingDot}/index.ts`;
		const entryName = withoutLeadingDot === '' ? 'index' : `${withoutLeadingDot}/index`;
		entries[entryName] = srcEntry;
	}

	if (Object.keys(entries).length === 0) {
		throw new Error(
			`Could not derive any tsdown entry points from ${pkgPath}#exports. ` +
				`Expected at least a "." entry pointing at "./dist/index.{mjs,cjs}".`,
		);
	}

	return entries;
}

function packageDir(override?: string): string {
	return override ?? process.cwd();
}

export function definePackageConfig(
	overrides: Partial<UserConfig> = {},
	pkgDir: string = packageDir(),
): ReturnType<typeof defineConfig> {
	const entry = deriveEntries(pkgDir);
	const pkgName = JSON.parse(readFileSync(resolve(pkgDir, 'package.json'), 'utf8')) as {
		name: string;
	};

	return defineConfig({
		format: ['esm', 'cjs'],
		dts: {
			sourcemap: true,
			compilerOptions: {
				isolatedDeclarations: true,
				declaration: true,
			},
		},
		sourcemap: true,

		clean: true,

		unbundle: true,

		platform: 'node',

		nodeProtocol: false,

		name: pkgName.name,

		entry,
		...overrides,
	});
}

export type { UserConfig };
