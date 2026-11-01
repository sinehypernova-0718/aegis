import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
	plugins: [vue(), tailwindcss()],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
	server: {
		// Loopback only. Aegis is a local-first security application: the dev
		// server must never expose the vault UI to other machines on the
		// network. Use a tunnel/proxy that enforces auth if LAN access is
		// ever explicitly required.
		host: '127.0.0.1',
		port: 3000,
		strictPort: true,
		hmr: { port: 3000 },
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
		 */
		proxy: {
			'/auth/session': 'http://127.0.0.1:7787',
			'/vaults': 'http://127.0.0.1:7787',
			'/healthz': 'http://127.0.0.1:7787',
			'/readyz': 'http://127.0.0.1:7787',
		},
	},
});
