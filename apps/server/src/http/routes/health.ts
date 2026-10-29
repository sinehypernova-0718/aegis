import type { FastifyInstance } from 'fastify';

export interface HealthRouteDeps {
	/** Bounded database connectivity check. Must reject when the database is unavailable. */
	readonly checkReadiness: () => Promise<void>;
}

export function registerHealthRoutes(app: FastifyInstance, deps: HealthRouteDeps): void {
	// Liveness: the process is running. Never touches PostgreSQL.
	app.get('/healthz', async (_request, reply) => {
		return reply.code(200).send({ status: 'ok' });
	});

	// Readiness: required dependencies are operational. Bounded by the caller.
	app.get('/readyz', async (request, reply) => {
		try {
			await deps.checkReadiness();
			return reply.code(200).send({ status: 'ready' });
		} catch {
			// Never log or return connection details.
			request.log.warn('readiness check failed');
			return reply.code(503).send({ status: 'unavailable' });
		}
	});
}
