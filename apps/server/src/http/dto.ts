import type {
	CreateCredentialResponse,
	CredentialDetail,
	CredentialPayloadFields,
	CredentialSummary,
	UpdateCredentialResponse,
} from '@aegis/contracts';
import type { CredentialPayloadInput, CredentialView, UpdateCredentialResult } from '@aegis/domain';

/**
 * Adapt a validated wire payload to the domain input shape. Optional fields are
 * only copied when present because the domain uses `exactOptionalPropertyTypes`
 * (an explicit `undefined` is not the same as omission).
 */
export function toDomainCredentialPayload(
	payload: CredentialPayloadFields,
): CredentialPayloadInput {
	return {
		type: payload.type,
		name: payload.name,
		secret: payload.secret,
		tags: [...payload.tags],
		...(payload.username !== undefined ? { username: payload.username } : {}),
		...(payload.url !== undefined ? { url: payload.url } : {}),
		...(payload.notes !== undefined ? { notes: payload.notes } : {}),
		...(payload.expiresAt !== undefined ? { expiresAt: payload.expiresAt } : {}),
	};
}

/**
 * Explicit, field-by-field projection from the domain view to the wire DTO.
 * Spreading the domain payload is avoided so a future domain field cannot leak
 * into a summary response by accident.
 */
export function toCredentialSummary(view: CredentialView): CredentialSummary {
	const payload = view.payload;
	return {
		id: view.id,
		createdAt: view.createdAt,
		updatedAt: view.updatedAt,
		type: payload.type,
		name: payload.name,
		...(payload.username !== undefined ? { username: payload.username } : {}),
		...(payload.url !== undefined ? { url: payload.url } : {}),
		tags: [...payload.tags],
		...(payload.expiresAt !== undefined ? { expiresAt: payload.expiresAt } : {}),
	};
}

/** Detail is the only projection that carries the secret (and notes). */
export function toCredentialDetail(view: CredentialView): CredentialDetail {
	return {
		id: view.id,
		createdAt: view.createdAt,
		updatedAt: view.updatedAt,
		payload: view.payload,
	};
}

/** Creation returns the secret-free summary form. */
export function toCreateCredentialResponse(view: CredentialView): CreateCredentialResponse {
	return toCredentialSummary(view);
}

/** Updates return only identity and timestamp, never the submitted secret. */
export function toUpdateCredentialResponse(
	result: UpdateCredentialResult,
): UpdateCredentialResponse {
	return { id: result.id, updatedAt: result.updatedAt };
}
