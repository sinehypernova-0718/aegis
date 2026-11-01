/**
 * Vault client — the active service boundary.
 * Currently points to the mock adapter. Replace with HTTP client when backend is ready.
 */

import type { VaultClient } from './contracts';
import { mockVaultClient } from '@/services/mock/mockVaultClient';

/**
 * The active vault client implementation.
 * Swap this for a real HTTP client when the Aegis backend is available.
 */
export const vaultClient: VaultClient = mockVaultClient;
