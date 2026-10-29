import { pathToFileURL } from 'node:url';

import { main } from './lifecycle.js';

export const packageName = '@aegis/server' as const;

export { readServerConfig, LOOPBACK_HOST } from './config.js';
export type { LogLevel, ServerConfig, UnlockThrottleConfig } from './config.js';
export { buildServer } from './http/build-server.js';
export type { BuildServerOptions } from './http/build-server.js';
export type { AppContainer, SessionLifecycle } from './http/dependencies.js';
export { createRuntime, main, startServer } from './lifecycle.js';
export type {
	AegisRuntime,
	CreateRuntimeOptions,
	RunningServer,
	RuntimeFactories,
	StartServerOptions,
} from './lifecycle.js';

function isMainModule(): boolean {
	const entry = process.argv[1];
	return entry !== undefined && import.meta.url === pathToFileURL(entry).href;
}

if (isMainModule()) {
	void main();
}
