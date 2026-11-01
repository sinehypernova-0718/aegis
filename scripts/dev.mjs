#!/usr/bin/env node
/**
 * `pnpm dev` — single-command Aegis startup.
 *
 * Loads `.env` from the repo root (DATABASE_URL & co.), applies database
 * migrations (idempotent), then runs the backend (`apps/server`, tsx watch)
 * and the web app (`apps/web`, Vite dev server with the API proxy) together.
 * When both are accepting connections it prints the URL and opens the UI.
 *
 * Ctrl+C: on Windows, processes launched through a console get the interrupt
 * twice (the classic `Terminate batch job`) or not at all for detached children
 * (the orphan-process problem this script exists to avoid). The handlers below
 * kill the whole process tree (`taskkill /T /F`) on every exit path.
 *
 * Flags: `--no-open` to skip opening the browser.
 */

import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';

import { config } from 'dotenv';

const ROOT = process.cwd();
const ROOT_ENV = resolve(import.meta.dirname, '../.env');
const IS_WINDOWS = process.platform === 'win32';
const OPEN_BROWSER = !process.argv.includes('--no-open');

const SERVER_PORT = 7787;
const WEB_PORT = 3000;

// ---- environment -----------------------------------------------------------

// Shell-set variables win; .env fills the rest. Missing values exit loudly.
config({ path: ROOT_ENV, quiet: true });

if (!process.env.DATABASE_URL) {
	console.error(
		'\n[aegis] DATABASE_URL is not set.\n' +
			'        Add it to the repo root .env, e.g.\n' +
			"        DATABASE_URL=postgresql://<user>:<password>@localhost:5432/aegis\n",
	);
	process.exit(1);
}

// ---- children --------------------------------------------------------------

const children = [];

function spawnMember(label, command, args) {
	const child = spawn(command, args, {
		cwd: ROOT,
		shell: IS_WINDOWS, // pnpm / vite resolve to .cmd on Windows
		env: process.env,
	});
	children.push({ label, child });
	const pipe = (stream, out) => {
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
	pipe(`${label}:out`, child.stdout);
	pipe(`${label}:err`, child.stderr);
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

// ---- readiness probe -------------------------------------------------------

async function awaitPort(port, name) {
	const started = Date.now();
	while (Date.now() - started < 30_000) {
		const open = await new Promise((resolve) => {
			const socket = createServer();
			// A listener elsewhere means the port is taken by a READY process.
			socket.once('error', () => resolve(true));
			socket.listen(port, '127.0.0.1', () => {
				socket.close(() => resolve(false));
			});
		});
		if (open) return;
		await new Promise((resolve) => setTimeout(resolve, 400));
	}
	console.error(`[aegis] ${name} did not become ready on 127.0.0.1:${port} in 30s.`);
}

// ---- orchestration ---------------------------------------------------------

console.log('\n[aegis] applying database migrations (idempotent)...');
const migrate = spawnSync('pnpm', ['db:migrate'], { cwd: ROOT, shell: IS_WINDOWS, stdio: 'inherit' });
if (migrate.status !== 0) {
	console.error('[aegis] migration failed, aborting startup.');
	process.exit(migrate.status ?? 1);
}

console.log('[aegis] starting server (127.0.0.1:7787) and web UI (127.0.0.1:3000)...\n');
spawnMember('server', 'pnpm', ['--filter', '@aegis/server', 'dev']);
spawnMember('web', 'pnpm', ['--filter', '@aegis/web', 'dev']);
await awaitPort(SERVER_PORT, 'server');
await awaitPort(WEB_PORT, 'web');

console.log(
	`\n[aegis] ready — open ${`http://127.0.0.1:${WEB_PORT}`}\n` +
		'        session handoff + vault status run automatically on page load.\n',
);

if (OPEN_BROWSER) {
	const url = `http://127.0.0.1:${WEB_PORT}`;
	if (IS_WINDOWS) spawn('cmd', ['/c', 'start', '', url], { shell: true, detached: true, stdio: 'ignore' });
	else spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref?.();
}
