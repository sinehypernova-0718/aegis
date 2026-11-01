import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

const BACKEND = 'http://127.0.0.1:7787';

export default defineConfig({
	plugins: [vue(), tailwindcss()],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
	/**
	 * Same-origin API access in development.
	 *
	 * In production the Aegis server serves the built UI directly, so the
	 * browser talks to one loopback origin and the session cookie +
	 * `credentials: 'same-origin'` behave exactly as designed. The dev server
	 * reproduces that model by proxying the API paths to the Aegis server on
	 * `127.0.0.1:7787`: the browser still sees a single origin, the HttpOnly
	 * cookie is set (and sent) against the Vite origin, and no cross-origin
	 * request ever carries the credential.
	 *
	 * `changeOrigin: true` satisfies the backend's loopback Host check
	 * (`apps/server/src/http/security.ts`), and the rewritten `Origin`
	 * satisfies its exact-match origin allow-list without requiring
	 * AEGIS_ALLOWED_ORIGINS to be exported in dev. Note the backend serves
	 * only /auth/session, /vaults/... and health probes — the remaining UI
	 * routes are Vite's own.
	 *
	 * `vite preview` (`pnpm start`) mirrors this block below for the built UI.
	 */
	server: {
		// Loopback only. Aegis is a local-first security application: the dev
		// server must never expose the vault UI to other machines on the
		// network. Use a tunnel/proxy that enforces auth if LAN access is
		// ever explicitly required.
		host: '127.0.0.1',
		port: 3000,
		strictPort: true,
		hmr: { port: 3000 },
		proxy: {
			'^/(auth/session|vaults|healthz|readyz)': {
				target: BACKEND,
				changeOrigin: true,
				headers: { origin: BACKEND },
			},
		},
	},
	preview: {
		// Production build served by `pnpm start`: same loopback-only bind and
		// the same API proxy, so the built UI keeps the same-origin model
		// (session cookie handoff + credentials: 'same-origin') without the
		// Fastify server having to serve static files yet.
		host: '127.0.0.1',
		port: 3000,
		strictPort: true,
		proxy: {
			'^/(auth/session|vaults|healthz|readyz)': {
				target: BACKEND,
				changeOrigin: true,
				headers: { origin: BACKEND },
			},
		},
	},
});
