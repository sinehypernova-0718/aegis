# `@aegis/domain`

Framework-independent domain models, invariants, and use cases for Aegis. This
package orchestrates vault and credential operations. It owns **no** cryptography
and **no** database code: it defines ports, and the application composition root
(`apps/server`) injects concrete adapters.

## Responsibilities

- Vault lifecycle use cases: `InitializeVault`, `UnlockVault`, `LockVault`, `GetVaultStatus`.
- Credential use cases: `CreateCredential`, `GetCredential`, `ListCredentials`, `UpdateCredential`, `DeleteCredential`.
- A process-scoped `DefaultVaultSessionManager` (one session per vault).
- Credential payload schema, canonical serialization, and pagination cursors.
- Typed domain errors (`DomainError` hierarchy) mapped to transport error codes by the HTTP boundary.

## Boundaries

| The domain may                                                     | The domain must not                             |
| ------------------------------------------------------------------ | ----------------------------------------------- |
| Define narrow ports for crypto and persistence                   | Import crypto, database, or HTTP implementations |
| Depend on domain-owned bounds/error codes + `zod`                  | Perform key derivation or AEAD directly         |
| Receive an opaque injected `VaultCryptoPort`                       | Hold raw DEK/KEK bytes                          |
| Define repository ports satisfied structurally                     | Construct module-level session singletons       |

Crypto and Drizzle implementations are adapted at the composition boundary
(`apps/server/src/composition/`). The domain owns the minimum session interface
it needs and does not import `@aegis/crypto`, `@aegis/database`, or
`@aegis/contracts`.

## Ports

- `VaultRepositoryPort` — read vault state, atomically initialize a vault with its
  initial envelope, select the active (non-revoked) envelope.
- `CredentialRepositoryPort` — opaque ciphertext record CRUD, vault-scoped, with
  bounded keyset listing.
- `VaultCryptoPort` — `createVaultSession` / `unlockVaultSession` / `validateEnvelope`.
- `Clock`, `IdGenerator` — injected runtime collaborators.

## Session policy

- The session manager is instantiated by the composition root and injected; it is
  never a module singleton and is never serialized, so a process restart begins
  fully locked.
- At most one session per vault, enforced by a synchronous check-and-set.
- `run(vaultId, fn)` refuses new work once a vault is locking; `lock(vaultId)`
  drains in-flight operations, disposes the session, and is idempotent.

## Security invariants

- The entire credential payload (kind, name, username, secret, URL, notes, tags,
  expiry) is encrypted; only a constant `record_type = 'encrypted_payload'`
  discriminator and structural fields (`nonce`, `ciphertext`, versions) are stored
  in the clear.
- Serialized payloads are bounded by `ENCRYPTED_PAYLOAD_MAX_BYTES`; field and tag
  limits are enforced before persistence.
- Listing is all-or-nothing: a corrupt or unauthenticatable record fails the page.
- Errors and logs never contain plaintext secrets.

## Scripts

- `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm format`.
