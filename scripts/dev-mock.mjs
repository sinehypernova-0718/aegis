#!/usr/bin/env node
/**
 * `pnpm dev:mock` - frontend-only dev with the mock vault adapter.
 *
 * Unlike `pnpm dev` (real backend), this runs Vite only and opts into the mock
 * adapter via VITE_AEGIS_USE_MOCK_API=1. Useful for UI development and
 * screenshot work that does not need the Fastify server/PostgreSQL.
 */

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const WEB_CWD = resolve(ROOT, 'apps/web');

console.log('\n[aegis] starting web-only (mock adapter) on http://127.0.0.1:3000 ...\n');

const child = spawn('pnpm', ['dev'], {
	cwd: WEB_CWD,
	shell: process.platform === 'win32',
	stdio: 'inherit',
	env: { ...process.env, VITE_AEGIS_USE_MOCK_API: '1' },
});

child.on('exit', (code) => {
	process.exit(code ?? 0);
});
child.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGBREAK', () => child.kill('SIGBREAK'));
process.on('exit', () => {
	try { child.kill(); } catch { /* already gone */ }
});
