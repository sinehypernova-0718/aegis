import {
	CreateCredentialRequestSchema,
	CreateCredentialResponseSchema,
	CredentialCountsSchema,
	CredentialDetailSchema,
	CredentialParamsSchema,
	DeleteCredentialResponseSchema,
	ListCredentialsQuerySchema,
	type ListCredentialsResponse,
	ListCredentialsResponseSchema,
	UpdateCredentialRequestSchema,
	UpdateCredentialResponseSchema,
	VaultIdParamsSchema,
} from '@aegis/contracts';
import type { FastifyInstance } from 'fastify';

import type { AppContainer } from '../dependencies.js';
import {
	toCreateCredentialResponse,
	toCredentialDetail,
	toCredentialSummary,
	toDomainCredentialPayload,
	toUpdateCredentialResponse,
} from '../dto.js';
import { parseRequest } from '../validation.js';
import type { AuthenticateHandler } from './vaults.js';

export interface CredentialRouteDeps {
	readonly container: Pick<
		AppContainer,
		| 'createCredential'
		| 'getCredentialCounts'
		| 'getCredential'
		| 'listCredentials'
		| 'updateCredential'
		| 'deleteCredential'
	>;
	readonly authenticate: AuthenticateHandler;
}

export function registerCredentialRoutes(app: FastifyInstance, deps: CredentialRouteDeps): void {
	app.get(
		'/vaults/:vaultId/credential-counts',
		{ preHandler: deps.authenticate },
		async (request, reply) => {
			const params = parseRequest(VaultIdParamsSchema, request.params);
			const result = await deps.container.getCredentialCounts.execute({ vaultId: params.vaultId });
			return reply.code(200).send(CredentialCountsSchema.parse(result));
		},
	);

	app.post(
		'/vaults/:vaultId/credentials',
		{ preHandler: deps.authenticate },
		async (request, reply) => {
			const params = parseRequest(VaultIdParamsSchema, request.params);
			const body = parseRequest(CreateCredentialRequestSchema, request.body);
			const view = await deps.container.createCredential.execute({
				vaultId: params.vaultId,
				payload: toDomainCredentialPayload(body.payload),
			});
			return reply
				.code(201)
				.send(CreateCredentialResponseSchema.parse(toCreateCredentialResponse(view)));
		},
	);

	app.get(
		'/vaults/:vaultId/credentials',
		{ preHandler: deps.authenticate },
		async (request, reply) => {
			const params = parseRequest(VaultIdParamsSchema, request.params);
			const query = parseRequest(ListCredentialsQuerySchema, request.query);
			const result = await deps.container.listCredentials.execute({
				vaultId: params.vaultId,
				limit: query.limit,
				...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
			});
			const response: ListCredentialsResponse = {
				items: result.items.map(toCredentialSummary),
				nextCursor: result.nextCursor,
			};
			return reply.code(200).send(ListCredentialsResponseSchema.parse(response));
		},
	);

	app.get(
		'/vaults/:vaultId/credentials/:credentialId',
		{ preHandler: deps.authenticate },
		async (request, reply) => {
			const params = parseRequest(CredentialParamsSchema, request.params);
			const view = await deps.container.getCredential.execute({
				vaultId: params.vaultId,
				id: params.credentialId,
			});
			return reply.code(200).send(CredentialDetailSchema.parse(toCredentialDetail(view)));
		},
	);

	app.put(
		'/vaults/:vaultId/credentials/:credentialId',
		{ preHandler: deps.authenticate },
		async (request, reply) => {
			const params = parseRequest(CredentialParamsSchema, request.params);
			const body = parseRequest(UpdateCredentialRequestSchema, request.body);
			const result = await deps.container.updateCredential.execute({
				vaultId: params.vaultId,
				id: params.credentialId,
				payload: toDomainCredentialPayload(body.payload),
			});
			return reply
				.code(200)
				.send(UpdateCredentialResponseSchema.parse(toUpdateCredentialResponse(result)));
		},
	);

	app.delete(
		'/vaults/:vaultId/credentials/:credentialId',
		{ preHandler: deps.authenticate },
		async (request, reply) => {
			const params = parseRequest(CredentialParamsSchema, request.params);
			const result = await deps.container.deleteCredential.execute({
				vaultId: params.vaultId,
				id: params.credentialId,
			});
			return reply.code(200).send(DeleteCredentialResponseSchema.parse(result));
		},
	);
}
