#!/usr/bin/env node
/**
 * `pnpm start` — single-command *production-local* Aegis run.
 *
 * Builds any missing artifacts, then runs the compiled backend
 * (`apps/server/dist/index.js`, loopback 7787, graceful shutdown) together
 * with the production-compiled web UI via `vite preview` (loopback 3000, with
 * the same API proxy so the browser stays same-origin). No tsx, no HMR.
 *
 * Ctrl+C: same tree-kill strategy as `scripts/dev.mjs` — on Windows the whole
 * process group is force-killed so no orphaned node/vite survives.
 *
 * Flags: `--no-open` to skip opening the browser.
 */

import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { config } from 'dotenv';

const ROOT = process.cwd();
const ROOT_ENV = resolve(import.meta.dirname, '../.env');
const SERVER_DIST = resolve(ROOT, 'apps/server/dist/index.js');
const WEB_DIST = resolve(ROOT, 'apps/web/dist/index.html');
const IS_WINDOWS = process.platform === 'win32';
const OPEN_BROWSER = !process.argv.includes('--no-open');

const SERVER_PORT = 7787;
const WEB_PORT = 3000;

// ---- environment -----------------------------------------------------------

config({ path: ROOT_ENV, quiet: true });
if (!process.env.DATABASE_URL) {
	console.error(
		'\n[aegis] DATABASE_URL is not set.\n' +
			'        Add it to the repo root .env, e.g.\n' +
			"        DATABASE_URL=postgresql://<user>:<password>@localhost:5432/aegis\n",
	);
	process.exit(1);
}

// ---- children (identical lifecycle to dev.mjs) ------------------------------

const children = [];

function spawnMember(label, command, args) {
	const child = spawn(command, args, { cwd: ROOT, shell: IS_WINDOWS, env: process.env });
	children.push({ label, child });
	const pipe = (out) => {
		let carry = '';
		out.setEncoding('utf8');
		out.on('data', (chunk) => {
			carry += chunk;
			let index;
			while ((index = carry.indexOf('\n')) >= 0) {
				const line = carry.slice(0, index);
				carry = carry.slice(index + 1);
				if (line.trim() !== '') console.log(`  [${label}] ${line}`);
			}
		});
	};
	pipe(child.stdout);
	pipe(child.stderr);
	child.on('exit', (code) => {
		children.splice(children.findIndex((c) => c.child === child), 1);
		if (!shuttingDown) {
			console.error(`\n[aegis] ${label} exited (code ${code ?? 'signal'}). Shutting down.`);
			shutdown(1);
		}
	});
	return child;
}

function killChildren() {
	for (const { child } of children.splice(0)) {
		if (child.pid === undefined || child.exitCode !== null) continue;
		if (IS_WINDOWS) {
			spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
				stdio: 'ignore',
				shell: true,
			});
		} else {
			try {
				child.kill('SIGTERM');
			} catch {
				/* process already gone */
			}
		}
	}
}

let shuttingDown = false;
function shutdown(code = 0) {
	if (shuttingDown) return;
	shuttingDown = true;
	killChildren();
	process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGBREAK', () => shutdown(0));
process.on('exit', () => killChildren());
process.on('uncaughtException', (error) => {
	console.error('[aegis] unexpected failure:', error);
	shutdown(1);
});

async function awaitPort(port, name) {
	const started = Date.now();
	while (Date.now() - started < 30_000) {
		const taken = await new Promise((resolve) => {
			const socket = createServer();
			socket.once('error', () => resolve(true));
			socket.listen(port, '127.0.0.1', () => socket.close(() => resolve(false)));
		});
		if (taken) return;
		await new Promise((r) => setTimeout(r, 400));
	}
	console.error(`[aegis] ${name} did not become ready on 127.0.0.1:${port} in 30s.`);
}

// ---- build-on-demand --------------------------------------------------------

if (!existsSync(SERVER_DIST) || !existsSync(WEB_DIST)) {
	console.log('\n[aegis] building missing production artifacts (turbo caches the rest)...');
	const build = spawnSync('pnpm', ['build'], { cwd: ROOT, shell: IS_WINDOWS, stdio: 'inherit' });
	if (build.status !== 0) {
		console.error('[aegis] build failed, aborting startup.');
		process.exit(build.status ?? 1);
	}
}

// Also make sure the tables exist when pointing at a fresh database.
console.log('[aegis] applying database migrations (idempotent)...');
const migrate = spawnSync('pnpm', ['db:migrate'], { cwd: ROOT, shell: IS_WINDOWS, stdio: 'inherit' });
if (migrate.status !== 0) {
	console.error('[aegis] migration failed, aborting startup.');
	process.exit(migrate.status ?? 1);
}

console.log('\n[aegis] starting production server (127.0.0.1:7787) + built UI (127.0.0.1:3000)...\n');
spawnMember('server', 'node', ['apps/server/dist/index.js']);
spawnMember('preview', 'pnpm', ['--filter', '@aegis/web', 'exec', 'vite', 'preview']);
await awaitPort(SERVER_PORT, 'server');
await awaitPort(WEB_PORT, 'web');

console.log(`\n[aegis] ready — open http://127.0.0.1:${WEB_PORT}\n`);

if (OPEN_BROWSER) {
	const url = `http://127.0.0.1:${WEB_PORT}`;
	if (IS_WINDOWS) spawn('cmd', ['/c', 'start', '', url], { shell: true, detached: true, stdio: 'ignore' });
	else spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref?.();
}
