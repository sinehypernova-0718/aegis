import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
	InitializeVaultRequestSchema,
	InitializeVaultResponseSchema,
	LockVaultResponseSchema,
	UnlockVaultRequestSchema,
	UnlockVaultResponseSchema,
	VaultIdParamsSchema,
	VaultStatusResponseSchema,
} from '@aegis/contracts';
import { UnlockRejectedError } from '@aegis/domain';

import type { UnlockThrottle } from '../auth.js';
import type { AppContainer } from '../dependencies.js';
import { ThrottledError } from '../errors.js';
import { parseRequest } from '../validation.js';

export type AuthenticateHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export interface VaultRouteDeps {
	readonly container: Pick<
		AppContainer,
		'initializeVault' | 'unlockVault' | 'lockVault' | 'getVaultStatus'
	>;
	readonly authenticate: AuthenticateHandler;
	readonly unlockThrottle: UnlockThrottle;
}

export function registerVaultRoutes(app: FastifyInstance, deps: VaultRouteDeps): void {
	app.post('/vaults', { preHandler: deps.authenticate }, async (request, reply) => {
		const body = parseRequest(InitializeVaultRequestSchema, request.body);
		const result = await deps.container.initializeVault.execute({
			passphrase: body.passphrase,
			...(body.vaultId !== undefined ? { vaultId: body.vaultId } : {}),
		});
		return reply.code(201).send(
			InitializeVaultResponseSchema.parse({
				vaultId: result.vaultId,
				status: result.runtimeState,
			}),
		);
	});

	app.get('/vaults/:vaultId/status', { preHandler: deps.authenticate }, async (request, reply) => {
		const params = parseRequest(VaultIdParamsSchema, request.params);
		const result = await deps.container.getVaultStatus.execute({ vaultId: params.vaultId });
		return reply.code(200).send(VaultStatusResponseSchema.parse(result));
	});

	app.post('/vaults/:vaultId/unlock', { preHandler: deps.authenticate }, async (request, reply) => {
		const params = parseRequest(VaultIdParamsSchema, request.params);
		const body = parseRequest(UnlockVaultRequestSchema, request.body);

		if (deps.unlockThrottle.blocked) {
			throw new ThrottledError(deps.unlockThrottle.retryAfterMs);
		}

		try {
			const result = await deps.container.unlockVault.execute({
				vaultId: params.vaultId,
				passphrase: body.passphrase,
			});
			deps.unlockThrottle.recordSuccess();
			return reply.code(200).send(UnlockVaultResponseSchema.parse(result));
		} catch (error) {
			// Only rejected authentication counts; conflicts/not-found do not
			// let an unauthenticated caller extend an unlocked session's life.
			if (error instanceof UnlockRejectedError) deps.unlockThrottle.recordFailure();
			throw error;
		}
	});

	app.post('/vaults/:vaultId/lock', { preHandler: deps.authenticate }, async (request, reply) => {
		const params = parseRequest(VaultIdParamsSchema, request.params);
		const result = await deps.container.lockVault.execute({ vaultId: params.vaultId });
		return reply.code(200).send(LockVaultResponseSchema.parse(result));
	});
}
