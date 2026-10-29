import type { CredentialPayload } from '../../credentials/credential-payload.js';

/** A decrypted credential as returned to the authorized local application. */
export interface CredentialView {
	readonly id: string;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly payload: CredentialPayload;
}
