import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'drizzle-kit';

function readEnvFile(path: string): Record<string, string> {
	try {
		const lines = readFileSync(path, 'utf8').split(/\r?\n/);
		const values: Record<string, string> = {};
		for (const line of lines) {
			const trimmed = line.trim();
			if (trimmed === '' || trimmed.startsWith('#')) continue;
			const separator = trimmed.indexOf('=');
			if (separator === -1) continue;
			const key = trimmed.slice(0, separator).trim();
			const value = trimmed
				.slice(separator + 1)
				.trim()
				.replace(/^['"]|['"]$/g, '');
			if (key !== '') values[key] = value;
		}
		return values;
	} catch {
		return {};
	}
}

const rootEnv = readEnvFile(resolve(process.cwd(), '../../.env'));
const databaseUrl =
	process.env.DATABASE_URL ??
	process.env.AEGIS_DATABASE_URL ??
	rootEnv.DATABASE_URL ??
	rootEnv.AEGIS_DATABASE_URL ??
	'';

export default defineConfig({
	out: './drizzle',
	schema: './src/schema/index.ts',
	dialect: 'postgresql',
	dbCredentials: {
		url: databaseUrl,
	},
	verbose: true,
	strict: true,
});
