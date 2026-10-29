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
- Typed domain errors (`DomainError` hierarchy) that map to `@aegis/contracts` error codes.

## Boundaries

| The domain may                                                     | The domain must not                             |
| ------------------------------------------------------------------ | ----------------------------------------------- |
| Use `@aegis/crypto` **types** (`VaultSession`, `VaultKeyEnvelope`) | Import Drizzle, `pg`, SQL, or `@aegis/database` |
| Depend on `@aegis/contracts` bounds/error codes + `zod`            | Perform key derivation or AEAD directly         |
| Receive an opaque injected `VaultCryptoPort`                       | Hold raw DEK/KEK bytes                          |
| Define repository ports satisfied structurally                     | Construct module-level session singletons       |

The concrete Drizzle repositories are adapted to the ports at the composition
boundary (`apps/server/src/composition/`), so no database types leak into this
package.

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
