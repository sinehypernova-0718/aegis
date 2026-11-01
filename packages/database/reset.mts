import { dirname, resolve } from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { Client } from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(here, '../../.env') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	console.error('DATABASE_URL is not set (expected ../../.env at the repository root).');
	process.exit(1);
}

const yes = process.argv.slice(2).includes('--yes');

async function confirm() {
	if (yes) return true;
	const rl = createInterface({ input, output });
	const answer = await rl.question(
		'This will DELETE ALL DATA from the Aegis database (vaults, records, envelopes). Continue? [y/N] ',
	);
	rl.close();
	return /^y(es)?$/i.test(answer.trim());
}

if (!(await confirm())) {
	console.log('Aborted: no changes made.');
	process.exit(0);
}

const client = new Client({ connectionString: databaseUrl });
try {
	await client.connect();
	await client.query(
		'TRUNCATE TABLE "vault_records", "vault_key_envelopes", "vaults" RESTART IDENTITY CASCADE',
	);
	console.log('All data cleared. Tables and schema are intact.');
} finally {
	await client.end();
}
