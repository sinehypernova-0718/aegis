# Aegis - Domain Layer & First Complete Vault Vertical Slice

**Implementation plan (reconnaissance only - no source modified)**

Status: **PROPOSED / AWAITING APPROVAL**. This document contains no implementation. It records verified
facts about `master`, proposes a concrete design, and lists decisions that must be closed before coding.

> **Revision 2** - incorporates review findings 1-7: narrowed crypto public surface (no public raw-DEK
> AEAD), multi-vault reconciliation, explicit initialization failure windows, fully resolved credential
> schema and pagination specification, and a concrete crypto composition adapter. All previously verified
> repository findings, interfaces, file inventory, test matrix, commands, PR breakdown, and the approval
> gate are preserved. New statements are marked **[verified]** (inspected in the working tree) or
> **[to verify]** (must be confirmed during implementation) - never asserted as fact otherwise.
- Repository: `sinehypernova-0718/aegis`
- Branch inspected: `master`
- HEAD: `104a197` - `feat(database): implement database foundation, schema, repositories, and migrations (#3)`
- Working tree at inspection time: clean
- Local toolchain observed: Node `v26.8.2`, pnpm `12.15.0`, PostgreSQL reachable on `localhost:5432` (psql 18 installed)

---

## 1. Executive summary and scope

Aegis is a local-first encrypted vault. Three packages already exist and are functional:
- `@aegis/contracts` - common Zod primitives, bounds, error codes and error envelope (Stage 1 only).
- `@aegis/crypto` - Argon2id KDF, DEK generation, XChaCha20-Poly1305 key wrapping, envelope schema + validation
  ("Flow A").
- `@aegis/database` - Drizzle/PostgreSQL schema, migrations, vault + vault-record repositories, transactions,
  error mapping.

`@aegis/domain` is empty (`src/index.ts` exports a single `packageName` constant). `apps/server` and `apps/web`
are `packageName` placeholders.

This milestone delivers the **first complete vertical slice**: vault initialization, unlock, lock, status, and
credential create/read/list/update/hard-delete - with **all credential metadata encrypted at rest**,
**process-local opaque sessions owned by crypto**, and **vault-scoped database access** - together with unit tests
and a real PostgreSQL vertical-slice test.

Key architectural positions (revised):
- **Multi-vault is preserved.** The schema already supports many vaults and one envelope set per vault; the domain
  keeps **one process-local session per vault**. No product-wide single-vault constraint is introduced.
- **Crypto's public surface is deliberately narrowed.** High-level `createVaultSession` / `unlockVaultSession` /
  `VaultSession` become the _only_ record-key operations exposed from `@aegis/crypto`. Raw-DEK AEAD helpers and the
  low-level key primitives (`deriveKek`, `generateDek`, `wrapKey`, `unwrapKey`, ...) are moved **out of the public
  `.` export** and remain package-internal.
- **Domain never touches raw keys.** It uses the opaque session type and a narrow, injected `VaultCryptoPort`.

**In scope:** crypto session API + record encryption; database envelope retrieval + vault-scoped record methods;
domain ports, errors, session manager, use cases; domain unit tests; database integration tests; cross-package
vertical-slice test; verification.

**Explicitly out of scope** (matches the brief 11): passphrase change/recovery keys, key rotation, reminders,
audit subsystem, provider catalog, frontend UI, broad HTTP API, cross-process session coordination,
Windows-native key storage, unrelated schema redesign, speculative frameworks.

---

## 2. Verified current-state findings

### 2.1 Repository, workspace, tooling **[verified]**

- Monorepo: `pnpm` workspace (`pnpm-workspace.yaml` -> `apps/*`, `packages/*`), Turborepo `turbo.json`,
  `typescript@7.0.2`, `tsdown@0.23.2`, `vitest@5.0.2`, `biome@2.6.2` (format only, linter disabled),
  `oxlint@1.89.0` (linter).
- Root scripts (`package.json`): `build`, `typecheck`, `lint`, `lint:fix`, `format`, `format:check`, `test`,
  `test:watch`, `test:coverage`, `check` (= lint -> format:check -> typecheck -> test), plus `db:*`.
- Turbo: `typecheck` and `test` both `dependsOn` `^build`; `test` output `coverage/**`.
- `tsconfig.base.json`: `target/lib ESNext`, `module/moduleResolution NodeNext`, `strict`, `isolatedModules`,
  `verbatimModuleSyntax`, `esModuleInterop`, `resolveJsonModule`, **`exactOptionalPropertyTypes`**,
  **`noUncheckedIndexedAccess`**, `useDefineForClassFields`.
- `tsdown.config.base.ts`: emits `esm`+`cjs`, `unbundle: true`, `platform: node`, `nodeProtocol: false`, and dts with
  **`isolatedDeclarations: true`**. ⇒ every public export (including domain) must be isolated-declaration safe
  (explicit return/`satisfies` types; no inferred public types).
- `vitest.base.ts`: `globals: true`, `environment: node`, `include: ['src/**/*.test.ts']`, `passWithNoTests: true`.
- `vitest.workspace.ts`: `packages/*/vitest.config.ts`, `apps/*/vitest.config.ts`.
- **Repo guidance:** there is **no `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, or `.cursorrules`** anywhere in the
  tree. `.serena/project.yml` is boilerplate with no project-specific instructions.
- **CI:** the only workflow is `.github/workflows/database.yml`, path-filtered to `packages/database/**`. It spins
  up PostgreSQL 16, runs `lint -> check -> typecheck -> build -> db:migrate -> test` for `@aegis/database` only.
  There is **no CI for crypto, contracts, domain, or a full `pnpm check`**. (Modifying CI is out of scope.)
- No `.changeset` directory exists, despite `@changesets/cli` being a dev dependency.
- **Cross-package imports:** no workspace package imports another `@aegis/*` package **[verified]** - a repo-wide
  search finds only package names, vitest `name` values, and `packageName` constants. Every package's tests import
  via relative paths. This is why narrowing crypto's public exports is safe.

### 2.2 `@aegis/contracts` **[verified]**

`src/index.ts` exports (only):
- Common: `ENTITY_ID_MAX_LENGTH` (36); `EntityId` / `EntityIdSchema` (uuid, branded);
  `IsoUtcTimestamp` / `IsoUtcTimestampSchema` (canonical `YYYY-MM-DDTHH:mm:ss.sssZ`, refined to real UTC);
  pagination (`PaginationLimitSchema`, `PaginationLimitWithDefaultSchema`, `PaginationQuerySchema`,
  `OpaqueCursorSchema`); `PAGINATION_DEFAULT_LIMIT = 20`, `PAGINATION_MAX_LIMIT = 100`, `CURSOR_MAX_LENGTH = 512`;
  `boundedString`, `boundedNonBlankString`, `boundedArray`, `strictObject`; `ContractVersionSchema` /
  `CONTRACT_VERSION = 1`; primitive strings `ShortTextSchema` (128), `TitleSchema` (256), `LabelSchema` (128),
  `LongTextSchema` (4096), `ClearableStringSchema`; bounds constants including **`ENCRYPTED_PAYLOAD_MAX_BYTES = 65_536`**,
  `ERROR_DETAIL_MAX_COUNT = 50`, `ERROR_MESSAGE_MAX_LENGTH = 512`, `REQUEST_ID_MAX_LENGTH = 128`.
- Errors: `ERROR_CODES` = `VALIDATION_ERROR | UNAUTHENTICATED | FORBIDDEN | NOT_FOUND | CONFLICT | VAULT_LOCKED |
  RATE_LIMITED | INTERNAL_ERROR`; `ErrorCodeSchema`; `SAFE_ERROR_MESSAGES` (frozen) + `safeMessageForCode`;
  `ErrorDetailSchema` / `ErrorResponseSchema` (+ types).

`packages/contracts/README.md` describes a **target** structure (`vault/`, `credentials/`, `catalog/`,
`lifecycle/`, `sessions/`) that **does not exist yet**. Only `common/` and `errors/` are implemented. The README
lists a proposed `CredentialKind` union (`password`, `api_key`, `access_token`, `refresh_token`, `ssh_key`,
`certificate`, `recovery_code`, `secure_note`) and a conceptual credential record - but as _design illustration_.

### 2.3 `@aegis/crypto` **[verified]**

Public API (`src/index.ts`):
- `createVaultKeyMaterial(passphrase) => Promise<VaultKeyEnvelope>` - creates key material, **returns only the
  envelope**; the DEK and KEK are cleaned in a `finally` block (no live session is retained).
- `deriveKek({ passphrase, salt?, params? }) => Promise<{ kek, salt, params }>`; `generateSalt(length?)`.
- KDF constants `KDF_DEFAULTS | KDF_MINIMUMS | KDF_MAXIMUMS`, `validateKdfParameters`.
- `generateDek()`, `DEK_LENGTH = 32`; `wrapKey`, `unwrapKey`, `WRAP_AAD`, `WrappedKey`.
- `createVaultKeyEnvelope`, `validateVaultKeyEnvelope`.
- `VaultKeyEnvelope`, `VaultKeyEnvelopeKdf`, `VaultKeyEnvelopeWrap`, `KdfAlgorithm`, `WrapAlgorithm`;
  `ENVELOPE_VERSION = 1`, `KDF_ALGORITHM = 'argon2id'`, `WRAP_ALGORITHM = 'xchacha20-poly1305'`,
  `toBase64Url`, `fromBase64Url`.
- Errors: `CryptoError` (base, has `code`), `InvalidParametersError`, `MalformedInputError`,
  `UnsupportedVersionError`, `AuthenticationError`, `EnvelopeValidationError`.

Facts that constrain the design:
- `AEAD_ALGORITHM` is defined in `src/types.ts` but **not re-exported** from `src/index.ts`.
- Envelope v1 = `{ version, kdf: { algorithm, salt, memoryKiB, passes, parallelism, tagLength }, wrap: { algorithm,
  nonce, ciphertext } }`; wrap nonce 24 bytes, ciphertext = 32-byte DEK + 16-byte tag; wrap AAD
  `aegis:vault-key-wrap:v1`.
- KDF bounds: memory 65536-262144 KiB, passes 3-5, parallelism 1-4, `tagLength` **exactly 32**, salt 16-64 bytes.
  `validateVaultKeyEnvelope` rejects out-of-range/unsupported values **before** any KDF work.
- `unwrapKey` throws `AuthenticationError` on wrong passphrase or tampering; `validateVaultKeyEnvelope` throws
  `UnsupportedVersionError` for `version !== 1` and `EnvelopeValidationError`/`MalformedInputError` for bad shape.
- **There is no session type, no `dispose`, no record (payload) encryption, and no unlock convenience function.**
  `crypto/README.md` states record encryption round-trips and unlock orchestration are _not yet implemented_.
- Dependencies: `@noble/ciphers@^1` only. `clean` from `@noble/ciphers/utils` is used for best-effort buffer
  wiping; `randomBytes` from `node:crypto`.

### 2.4 Crypto public-surface audit (raw-key exposure) **[verified]**

This is called out explicitly because the plan must not overclaim key isolation.

**On current `master`, `@aegis/crypto` publicly exports raw-key-producing operations.** Concretely, from
`src/index.ts`:

| Export                                                     | Returns/takes raw key material?          |
| ---------------------------------------------------------- | ---------------------------------------- |
| `deriveKek(...)`                                           | **Returns a raw KEK** (`Uint8Array`)     |
| `generateDek()`                                            | **Returns a raw DEK** (`Uint8Array`)     |
| `wrapKey(kek, dek, aad?)`                                  | **Takes raw KEK + raw DEK**              |
| `unwrapKey(kek, wrapped, aad?)`                            | **Returns a raw DEK**                    |
| `WRAP_AAD`, `DEK_LENGTH`, `KDF_*`, `validateKdfParameters` | No key material (parameters/constants)   |
| `createVaultKeyEnvelope`, `validateVaultKeyEnvelope`       | Envelope shape only; no raw keys         |
| `createVaultKeyMaterial(passphrase)`                       | Envelope only; internally cleans DEK/KEK |

So any consumer of `@aegis/crypto` today can derive a KEK, generate a DEK, and wrap/unwrap it. **The current plan
does not claim raw keys are inaccessible under the present API.**

**Resolution (proposal): deliberately narrow the public surface** (nothing outside the package imports these
**[verified]**, and crypto's own tests import them by relative path **[verified]**), so that:
- The public `.` entry exposes the **high-level session API** plus envelope **validation** and **types/constants/
  errors** (see 5.1).
- `deriveKek`, `generateSalt`, `generateDek`, `DEK_LENGTH`, `wrapKey`, `unwrapKey`, `WRAP_AAD`, `WrappedKey`,
  `createVaultKeyEnvelope`, `KDF_DEFAULTS/MINIMUMS/MAXIMUMS`, `validateKdfParameters`, `KdfParameters`,
  `DeriveKekInput`, `DerivedKek`, `KdfAlgorithm`, `WrapAlgorithm` are **removed from the public `.` export** and
  remain reachable only through **package-internal relative modules** used by crypto's own tests and by the new
  session implementation.
- After narrowing, **no public `.` export of `@aegis/crypto` returns or accepts raw DEK/KEK bytes** except the
  opaque `VaultSession`. This is the claim the design is allowed to make, and only _after_ the change lands.
- If future external access is ever needed, it must be added as an explicit, documented `@aegis/crypto/internal`
  subpath - **not** by re-widening the main entry. (Not added now.)

`createVaultKeyMaterial` is retained for compatibility (envelope-only, no raw keys). `validateVaultKeyEnvelope`,
`VaultKeyEnvelope*`, `ENVELOPE_VERSION`, `KDF_ALGORITHM`, `WRAP_ALGORITHM`, and the non-secret base64url helpers
remain public.

### 2.5 `@aegis/database` **[verified]**

Schema (`src/schema/`), mirrored by `drizzle/0000_initial.sql` (single migration, journal version 7):
- `vaults(id uuid pk, status text not null, encryption_format_version int not null, created_at timestamptz,
  updated_at timestamptz)` + index on `status`.
- `vault_key_envelopes(id uuid pk, vault_id uuid fk->vaults on delete cascade, purpose text, envelope_version int,
  envelope jsonb, created_at timestamptz, rotated_at timestamptz null, revoked_at timestamptz null)` + index on
  `vault_id` + **partial unique index `(vault_id, purpose) WHERE revoked_at IS NULL`**.
- `vault_records(id uuid pk, vault_id uuid fk->vaults cascade, record_type text, encryption_version int, nonce bytea,
  ciphertext bytea, created_at timestamptz, updated_at timestamptz, deleted_at timestamptz null)` + indexes on
  `vault_id`, `(vault_id, record_type)`, `created_at`.

Repositories (`src/repositories/`):
- `DrizzleVaultRepository implements VaultRepository`:
  `createVault`, `getVaultById`, `updateVaultStatus(id, status, updatedAt)`,
  `initializeVaultWithKeyEnvelopes(vault, envelopes)` - the last uses `withDatabaseTransaction` and inserts the
  vault + all envelopes atomically. It validates envelopes are non-empty and belong to the vault id.
- `DrizzleVaultRecordRepository implements VaultRecordRepository`:
  `createRecord`, **`getRecordById(id)` (scoped by id only, not by vault)**, `updateRecord(row)` (by id only),
  **`deleteRecord(id)` (by id only, returns `void`)**. There is **no listing** and **no vault-scoped read/delete**.

Other: `createDatabaseClient(config) => { database, pool, close }`; `readDatabaseClientConfig(env)` reading
`DATABASE_URL` or `AEGIS_DATABASE_URL`; `withDatabaseTransaction`; `mapDatabaseError` ->
`DatabaseError | RecordNotFoundError | UniqueConstraintViolationError`; `NewVaultRecord`/`VaultRecord` etc.
Build script runs `tsdown` then `tsc -p tsconfig.typecheck.json --declaration --emitDeclarationOnly`
(`isolatedDeclarations` disabled only for that declaration pass).

Integration tests (`src/integration.test.ts`): gated by `describe.skipIf(!databaseUrl)`; cover vault init, missing
envelopes rejection, unique envelope conflict, record CRUD + not-found, and transaction rollback on forced failure.

**Schema facts relevant to the review findings [verified]:**
- The schema is **plural/multi-vault by construction**: `vaults` is a collection keyed by uuid PK, and
  `vault_key_envelopes` is uniqued per `(vault_id, purpose)`. Nothing enforces "one vault".
- Timestamps use `timestamp(..., { mode: 'string' })`. The exact string format returned by the pg driver for
  `timestamptz` is **[to verify]** during implementation (see 7.3); it must be normalized to canonical ISO-8601
  UTC if it is not already.

**Conflicts / observations the plan must resolve (see 12):**
1. `integration.test.ts` writes **runtime-looking status values** `'active'`/`'locked'` via
   `updateVaultStatus` (lines 43-49). The brief forbids persisting unlocked/locked runtime state. This column must
   become durable-lifecycle-only and the test updated.
2. `integration.test.ts` writes `recordType: 'credential'` (line 162). The brief requires the actual credential
   kind to be encrypted, with a constant structural discriminator in the column. Test must change to the constant.
3. The envelope `purpose` used by existing tests is `'primary_windows'`. A canonical purpose must be chosen (12).

### 2.6 `@aegis/domain` **[verified]**

- `src/index.ts` -> `export const packageName = '@aegis/domain' as const;` only.
- `src/index.test.ts` -> placeholder that asserts `packageName`.
- `package.json`: **no `dependencies`**, dev only `@types/node`; scripts mirror the other packages.
- `tsconfig.json`: composite, `declaration: true`, `rootDir src`. No README file exists (though `files` lists it).
- `tsdown.config.ts`/`vitest.config.ts` use the shared base.

### 2.7 `apps/*` **[verified]**

- `apps/server/src/index.ts` and `apps/web/src/index.ts` export `packageName` only.
- `apps/server/package.json`: description mentions Fastify, but **no dependencies** are declared.
- No composition root, no HTTP routes, no Fastify wiring exists.

### 2.8 Environment **[verified]**

- `.env` exists and defines `DATABASE_URL` (value redacted). It is git-ignored.
- TCP `localhost:5432` reachable. `psql` 18 available.
- `node_modules` present; lockfile `pnpm-lock.yaml` present.

> **No `build`, `typecheck`, `lint`, `test`, or database command was executed during this planning phase.** Every
> check in 11 is a command to run _after approval_; none is claimed as passing.

---

## 3. Architecture and dependency rules

```
apps/web  ──(contracts)──▶ @aegis/contracts
apps/server (composition root) ─▶ @aegis/domain ─▶ @aegis/crypto (opaque session API only)
                                     │            └▶ @aegis/contracts (bounds, error codes)
                                     │
                                     └─(ports only; structural typing)◀── @aegis/database (Drizzle repos)
```

Rules enforced by this plan:
- **Domain orchestrates; crypto protects; database persists.** Domain defines ports; the composition root injects
  concrete Drizzle repositories and crypto adapters.
- **Crypto never depends on domain or database.** It gains a self-contained session + record-encryption API, and
  its public surface is narrowed so raw-DEK AEAD is package-internal (2.4, 5.1).
- **Database stays encryption-agnostic** - it stores opaque `nonce`/`ciphertext` bytes and never decrypts.
- **Domain does not depend on `@aegis/database`.** Ports are satisfied _structurally_ by the Drizzle classes at the
  composition root (verified feasible: `Vault`/`VaultRecord` are plain inferred row objects; `Buffer` is a
  `Uint8Array`). This avoids the "direct database dependency" the brief warns about.
- **Domain depends on `@aegis/crypto` for the opaque `VaultSession`/`VaultKeyEnvelope` types only**, plus a narrow
  `VaultCryptoPort` whose concrete implementation is injected by the composition root. Application/domain code
  never calls record AEAD directly and never sees a DEK/KEK.
- **Domain may depend on `@aegis/contracts` + `zod`** for shared bounds and the single payload-validation strategy.
- **The server never receives a raw DEK/KEK or serialized session.** Sessions are opaque objects; JSON
  serialization yields no key material (enforced with `#private` fields + a test).

---

## 4. Required flows (sequenced)

### 4.A Initialize vault (multi-vault, explicit failure windows)

```
input: { passphrase: string; vaultId?: string }        ← vaultId optional; generated if omitted
vaultId = input.vaultId ?? ids.generate()
now = clock()

1. crypto.createVaultSession({ vaultId, passphrase })
      ↳ derive KEK (Argon2id) -> generate DEK -> wrap DEK -> validate envelope
      ↳ returns { envelope, session }   (session holds DEK in #private fields)
   on failure -> dispose nothing (no session exists) -> propagate typed crypto error

2. TRY  repo.initializeVaultWithKeyEnvelopes(vault, [envelope])   ← single atomic transaction
   CATCH { session.dispose(); throw PersistenceError }            ← durable init failed; no session live

   ── durable commit succeeded below this line ──

3. TRY  sessionManager.register(vaultId, session)
   CATCH (registration failure - see below) {
      session.dispose();
      return { vaultId, runtimeState: 'locked' }   ← durable vault EXISTS; recover via UnlockVault
   }

4. return { vaultId, runtimeState: 'unlocked' }
```

**Failure-window semantics (explicit):**
- **Commit + registration failure.** If step 2 commits but step 3 fails, the vault **is durably initialized**.
  We must not roll it back and must not report a live session. The new session is disposed and the use case
  returns `runtimeState: 'locked'`. The vault is fully recoverable through `UnlockVault` using the persisted
  envelope. `GetVaultStatus(vaultId)` reports `locked`. This outcome is deterministic and testable.
- **Registration is race-safe.** `register` is a **synchronous** check-and-set on an instance `Map`; JS's
  single-threaded execution means two concurrent registrations for the same `vaultId` cannot both observe "absent".
  The loser throws `SessionRegistrationConflictError` and disposes its session.
- **Concurrent initialization for the same `vaultId`.** Because `vaults.id` is a PK and the envelope has a partial
  unique index on `(vault_id, purpose)`, only one of two concurrent initializations with the same id can commit.
  The second fails with a unique-violation -> `VaultAlreadyInitializedError`. Distinct ids create distinct vaults
  (allowed, multi-vault). No `getFirstVault()` "check-then-insert" is used.
- **Status written to the DB is durable-lifecycle only** (proposed value `'initialized'`); never `locked`/`unlocked`.

### 4.B Unlock

```
vault = repo.getVaultById(vaultId); if null -> VaultNotFoundError
if sessionManager.isUnlocked(vaultId) -> VaultAlreadyUnlockedError          (policy; 12)
row = repo.getActiveKeyEnvelope(vaultId, purpose); if null -> InvalidKeyEnvelopeError
crypto.validateEnvelope(row.envelope)      ← cheap structural/version check BEFORE Argon2id
session = await crypto.unlockVaultSession({ vaultId, passphrase, envelope })
        ↳ wrong passphrase / tampering -> AuthenticationError -> UnlockRejectedError (safe, generic)
        ↳ unsupported version -> UnsupportedEncryptionFormatError
        ↳ malformed -> InvalidKeyEnvelopeError
if sessionManager.isUnlocked(vaultId) now (race) { session.dispose(); throw VaultAlreadyUnlockedError }
sessionManager.register(vaultId, session)
return { vaultId, status: 'unlocked' }
```

Invariant: no failure path registers a session. External mapping does not distinguish wrong password from tampering.

### 4.C Create credential

```
session = sessionManager.begin(vaultId)        ← in-flight tracked; locked -> VaultLockedError
payload  = validateCredentialPayload(input)    ← single canonical validator + defaults (5.4)
plaintext = serializeCanonical(payload)        ← fixed field order; UTF-8 bytes <= ENCRYPTED_PAYLOAD_MAX_BYTES
recordId = uuid(); now = clock()
enc = session.encryptRecord({ recordId, plaintext })   ← fresh 24-byte nonce; AAD(vaultId, recordId, version)
row = { id: recordId, vaultId, recordType: ENCRYPTED_RECORD_TYPE, encryptionVersion: enc.encryptionVersion,
        nonce: enc.nonce, ciphertext: enc.ciphertext, createdAt: now, updatedAt: now, deletedAt: null }
await repo.createRecord(row)                   ← failure ⇒ PersistenceError; never a success response
return { id, createdAt, updatedAt, payload }
```

### 4.D Retrieve / list

- **Get:** `repo.getRecordById(vaultId, id)` (vault + id scoped) -> reject missing/out-of-scope with
  `CredentialNotFoundError`; check `encryptionVersion`; `session.decryptRecord(...)`; validate decrypted schema.
- **List:** bounded `limit` (1..`PAGINATION_MAX_LIMIT`, default `PAGINATION_DEFAULT_LIMIT`), deterministic keyset
  order, strict cursor validation (7.3). Decrypt+validate each record; **all-or-nothing**: any
  malformed/unauthenticatable record fails the whole page (`CredentialDecryptionError` /
  `InvalidCredentialPayloadError`).

### 4.E Update

```
begin(vaultId) -> row = getRecordById(vaultId, id) or CredentialNotFoundError
payload = validate(full replacement) -> plaintext -> size check
enc = session.encryptRecord({ recordId: id, plaintext })   ← FRESH nonce, same AAD identity
updatedAt = clock()
repo.updateRecord({ ...row, encryptionVersion, nonce, ciphertext, updatedAt })
return { id, updatedAt, payload }
```

Concurrency: last-write-wins, **no optimistic version check** for this milestone (12).

### 4.F Delete (hard)

```
begin(vaultId) -> ok = repo.deleteRecord(vaultId, id)
if !ok -> CredentialNotFoundError
return { id, deleted: true }
```

Physical `DELETE ... WHERE vault_id = $1 AND id = $2`. `deleted_at` is retained only for schema compatibility.

### 4.G Lock

```
sessionManager.lock(vaultId):
  entry = registry.get(vaultId); if none -> idempotent no-op
  entry.state = 'locking'            ← begin() now rejects new operations (VaultLockedError)
  await drain: wait until entry.inFlight === 0
  entry.session.dispose()
  registry.delete(vaultId)
return { vaultId, status: 'locked' }
```

### 4.H Process restart

Registry is instance-scoped and never serialized. A new process/manager starts empty ⇒ every vault is `locked`
until a fresh successful unlock. No plaintext or session material is written to disk.

---

## 5. Exact proposed TypeScript public API signatures

> All **proposals**. Names follow existing repo conventions; adjust during review if preferred.

### 5.1 `@aegis/crypto` - public surface (narrowed) and internal modules

**Public `.` entry (proposed final export list):**

```ts
// High-level session API (the ONLY record-key operations exposed)
export { createVaultSession } from './vault/create-vault-session.js';
export { unlockVaultSession } from './vault/unlock-vault-session.js';
export type { VaultSession } from './session/vault-session.js';
export type { CreatedVaultSession, CreateVaultSessionInput } from './vault/create-vault-session.js';
export type { UnlockVaultSessionInput } from './vault/unlock-vault-session.js';
export type { EncryptedRecord } from './records/record-encryption.js';

// Envelope creation + validation (no raw keys)
export { createVaultKeyMaterial } from './vault/create-vault-key-material.js';
export type { CreateVaultKeyMaterialOptions } from './vault/create-vault-key-material.js';
export { validateVaultKeyEnvelope } from './envelope/validate-envelope.js';

// Envelope types + non-secret constants
export type { VaultKeyEnvelope, VaultKeyEnvelopeKdf, VaultKeyEnvelopeWrap } from './types.js';
export {
	ENVELOPE_VERSION,
	KDF_ALGORITHM,
	WRAP_ALGORITHM,
	toBase64Url,
	fromBase64Url,
} from './types.js';

// Record-encryption format constants (no keys)
export {
	RECORD_ENCRYPTION_VERSION,
	RECORD_AEAD_ALGORITHM,
	RECORD_NONCE_LENGTH,
	RECORD_TAG_LENGTH,
	MAX_RECORD_PLAINTEXT_BYTES,
	MAX_RECORD_CIPHERTEXT_BYTES,
} from './records/record-encryption.js';

// Errors
export {
	CryptoError,
	InvalidParametersError,
	MalformedInputError,
	UnsupportedVersionError,
	AuthenticationError,
	EnvelopeValidationError,
	SessionDisposedError,
	RecordSizeError,
} from './errors.js';
```

**Deliberately removed from the public `.` entry** (remain package-internal; imported by relative path in crypto's
own tests and session code): `deriveKek`, `generateSalt`, `generateDek`, `DEK_LENGTH`, `wrapKey`, `unwrapKey`,
`WRAP_AAD`, `WrappedKey`, `createVaultKeyEnvelope`, `KDF_DEFAULTS`, `KDF_MINIMUMS`, `KDF_MAXIMUMS`,
`validateKdfParameters`, and the types `DerivedKek`, `DeriveKekInput`, `KdfParameters`, `KdfAlgorithm`,
`WrapAlgorithm`. Rationale and safety evidence in 2.4.

**Internal modules (not exported):**

```ts
// src/records/record-encryption.ts   (INTERNAL - raw-DEK AEAD)
export const RECORD_ENCRYPTION_VERSION = 1 as const;
export const RECORD_AEAD_ALGORITHM = 'xchacha20-poly1305' as const;
export const RECORD_NONCE_LENGTH = 24 as const;
export const RECORD_TAG_LENGTH = 16 as const;
export const RECORD_AAD_LABEL = 'aegis:credential:v1' as const;
export const MAX_RECORD_PLAINTEXT_BYTES = 65_536 as const;
export const MAX_RECORD_CIPHERTEXT_BYTES = 65_552 as const; // plaintext + 16-byte tag

export interface RecordAadContext {
	readonly vaultId: string;
	readonly recordId: string;
	readonly encryptionVersion: number;
}
export interface EncryptedRecord {
	readonly encryptionVersion: number;
	readonly nonce: Uint8Array;
	readonly ciphertext: Uint8Array;
}
/** Deterministic, length-prefixed, domain-separated AAD encoder. INTERNAL. */
export function encodeRecordAad(context: RecordAadContext): Uint8Array;
/** INTERNAL: DEK-in, ciphertext-out. Never exported from the package entry. */
export function encryptRecord(
	dek: Uint8Array,
	context: RecordAadContext,
	plaintext: Uint8Array,
): EncryptedRecord;
export function decryptRecord(
	dek: Uint8Array,
	record: {
		readonly nonce: Uint8Array;
		readonly ciphertext: Uint8Array;
		readonly vaultId: string;
		readonly recordId: string;
	},
): Uint8Array;
```

```ts
// src/session/vault-session.ts   (PUBLIC interface; implementation class stays internal)
export interface VaultSession {
	readonly vaultId: string;
	readonly isDisposed: boolean;
	encryptRecord(input: {
		readonly recordId: string;
		readonly plaintext: Uint8Array;
	}): EncryptedRecord;
	decryptRecord(input: {
		readonly recordId: string;
		readonly encryptionVersion: number;
		readonly nonce: Uint8Array;
		readonly ciphertext: Uint8Array;
	}): Uint8Array;
	/** Best-effort key wipe. Not a guarantee of secure erasure in V8. Idempotent. */
	dispose(): void;
}
```

```ts
// src/vault/create-vault-session.ts   (PUBLIC)
export interface CreateVaultSessionInput {
	readonly vaultId: string;
	readonly passphrase: string;
}
export interface CreatedVaultSession {
	readonly envelope: VaultKeyEnvelope;
	readonly session: VaultSession;
}
export async function createVaultSession(
	input: CreateVaultSessionInput,
): Promise<CreatedVaultSession>;

// src/vault/unlock-vault-session.ts   (PUBLIC)
export interface UnlockVaultSessionInput {
	readonly vaultId: string;
	readonly passphrase: string;
	readonly envelope: unknown;
}
export async function unlockVaultSession(input: UnlockVaultSessionInput): Promise<VaultSession>;

// src/errors.ts   (PUBLIC additions)
export class SessionDisposedError extends CryptoError {
	/* code: 'CRYPTO_SESSION_DISPOSED' */
}
export class RecordSizeError extends CryptoError {
	/* code: 'CRYPTO_RECORD_SIZE' */
}
```

**Design points (chosen deliberately):**
- Session is a **class instance with `#private` fields** holding `vaultId`, the DEK, and a `disposed` flag.
  `JSON.stringify(session)` yields `{}`; there is no `toJSON`. It is not reconstructible from persisted state.
- AAD binds `vaultId + recordId + encryptionVersion` via a **length-prefixed binary encoding** with a fixed label
  (delimiter concatenation is explicitly avoided because ids/labels could otherwise be ambiguous).
- `encryptRecord`/`decryptRecord` are **synchronous** (noble is sync, fresh nonce per call, Node single-threaded),
  so no crypto-level cancellation exists; lock concurrency concerns only async _database_ operations.
- `dispose()` wipes the DEK best-effort and flips the flag; subsequent operations throw `SessionDisposedError`.
- `unlockVaultSession` calls `validateVaultKeyEnvelope` **before** deriving the KEK.

### 5.2 `@aegis/domain` - ports

```ts
// src/ports/vault-repository.ts
export interface VaultState {
	readonly id: string;
	readonly status: string;
	readonly encryptionFormatVersion: number;
	readonly createdAt: string;
	readonly updatedAt: string;
}
export interface NewVaultState {
	readonly id: string;
	readonly status: string;
	readonly encryptionFormatVersion: number;
	readonly createdAt: string;
	readonly updatedAt: string;
}
export interface PersistedKeyEnvelope {
	readonly id: string;
	readonly vaultId: string;
	readonly purpose: string;
	readonly envelopeVersion: number;
	readonly envelope: unknown;
	readonly createdAt: string;
}
export interface NewPersistedKeyEnvelope extends PersistedKeyEnvelope {}

export interface VaultRepositoryPort {
	getVaultById(id: string): Promise<VaultState | null>;
	initializeVaultWithKeyEnvelopes(
		vault: NewVaultState,
		envelopes: readonly NewPersistedKeyEnvelope[],
	): Promise<VaultState>;
	getActiveKeyEnvelope(vaultId: string, purpose: string): Promise<PersistedKeyEnvelope | null>;
}
```

> **Multi-vault:** no `getFirstVault()` / `countVaults()` is required. Initialization inserts a vault by id; the PK
> and partial-unique envelope index make duplicate ids fail safely (4.A).

```ts
// src/ports/credential-repository.ts
export interface CredentialRecordRow {
	readonly id: string;
	readonly vaultId: string;
	readonly recordType: string;
	readonly encryptionVersion: number;
	readonly nonce: Uint8Array;
	readonly ciphertext: Uint8Array;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly deletedAt: string | null;
}
export interface NewCredentialRecordRow extends CredentialRecordRow {}

export interface CredentialListOptions {
	readonly limit: number;
	readonly after?: { readonly createdAt: string; readonly id: string } | undefined;
}

export interface CredentialRepositoryPort {
	createRecord(input: NewCredentialRecordRow): Promise<CredentialRecordRow>;
	getRecordById(vaultId: string, id: string): Promise<CredentialRecordRow | null>;
	listRecordsByVault(
		vaultId: string,
		options: CredentialListOptions,
	): Promise<CredentialRecordRow[]>;
	updateRecord(input: CredentialRecordRow): Promise<CredentialRecordRow>;
	deleteRecord(vaultId: string, id: string): Promise<boolean>;
}
```

```ts
// src/ports/vault-crypto.ts  - narrow behaviour port so unit tests avoid real Argon2
import type { VaultKeyEnvelope, VaultSession } from '@aegis/crypto';
export interface VaultCryptoPort {
	createVaultSession(input: {
		vaultId: string;
		passphrase: string;
	}): Promise<{ envelope: VaultKeyEnvelope; session: VaultSession }>;
	unlockVaultSession(input: {
		vaultId: string;
		passphrase: string;
		envelope: unknown;
	}): Promise<VaultSession>;
	validateEnvelope(input: unknown): VaultKeyEnvelope; // throws typed crypto errors
}
```

```ts
// src/ports/runtime.ts
export interface Clock {
	now(): string;
} // ISO-8601 UTC, millisecond precision
export interface IdGenerator {
	generate(): string;
} // uuid v4
```

### 5.3 `@aegis/domain` - session manager

```ts
// src/sessions/vault-session-manager.ts
export interface VaultSessionManager {
	/** Synchronous check-and-set. Throws SessionRegistrationConflictError if already registered. */
	register(vaultId: string, session: VaultSession): void;
	isUnlocked(vaultId: string): boolean;
	/** Runs `fn` inside an in-flight scope; throws VaultLockedError if locked/locking. */
	run<T>(vaultId: string, fn: (session: VaultSession) => Promise<T>): Promise<T>;
	/** Blocks new ops, drains in-flight, disposes, unregisters. Idempotent per vault. */
	lock(vaultId: string): Promise<void>;
}

export class DefaultVaultSessionManager implements VaultSessionManager {
	/* instance-scoped; no module singleton */
}
```

### 5.4 `@aegis/domain` - credential payload (resolved)

```ts
// src/credentials/credential-payload.ts
export const CREDENTIAL_PAYLOAD_SCHEMA_VERSION = 1 as const;

export type CredentialKind =
  | 'password' | 'api_key' | 'access_token' | 'refresh_token'
  | 'ssh_key' | 'certificate' | 'recovery_code' | 'secure_note';

export interface CredentialPayload {
  readonly schemaVersion: typeof CREDENTIAL_PAYLOAD_SCHEMA_VERSION;  // literal 1
  readonly type: CredentialKind;
  readonly name: string;                 // required, 1..256 chars
  readonly secret: string;               // required, 1..32768 chars (see 5.4.1)
  readonly username?: string;            // optional, 1..256
  readonly url?: string;                 // optional, 1..2048
  readonly notes?: string;               // optional, 1..4096
  readonly tags: readonly string[];      // 0..32 items, each 1..128 chars
  readonly expiresAt?: string;           // optional, canonical ISO-8601 UTC (IsoUtcTimestamp)
}

export const CredentialPayloadSchema: z.ZodType<CredentialPayload, CredentialPayloadInput>;
export type CredentialPayloadInput = z.input<typeof CredentialPayloadSchema>;

export function validateCredentialPayload(input: unknown): CredentialPayload;
export function serializeCredentialPayload(payload: CredentialPayload): Uint8Array; // canonical, fixed key order
export function parseCredentialPayload(bytes: Uint8Array): CredentialPayload;       // JSON.parse + validate
```

#### 5.4.1 Credential schema - fully resolved (finding 4)

**Kind set (8).** `password`, `api_key`, `access_token`, `refresh_token`, `ssh_key`, `certificate`,
`recovery_code`, `secure_note` (matches the documented intent in `contracts/README.md`).

**Required vs optional per kind.** The schema is **uniform** across kinds (one shape, one validator, one canonical
serializer) to keep the payload contract small and the at-rest format stable. Required: `schemaVersion`, `type`,
`name`, `secret`. Optional for every kind: `username`, `url`, `notes`, `tags`, `expiresAt`. This intentionally does
not over-constrain kinds; it is a deliberate simplicity choice for the first slice.

| Field           | Required          | Type             | Bound                  | Notes                                                     |
| --------------- | ----------------- | ---------------- | ---------------------- | --------------------------------------------------------- |
| `schemaVersion` | yes               | literal `1`      | -                      | payload schema version (distinct from encryption version) |
| `type`          | yes               | `CredentialKind` | 8-value enum           | encrypted; never persisted plaintext                      |
| `name`          | yes               | string           | 1-256                  | displayed label; encrypted                                |
| `secret`        | yes               | string           | 1-32768                | see representation below                                  |
| `username`      | no                | string           | 1-256                  | account identifier                                        |
| `url`           | no                | string           | 1-2048                 | service endpoint                                          |
| `notes`         | no                | string           | 1-4096                 | free text                                                 |
| `tags`          | yes (may be `[]`) | `string[]`       | <=32 items, each 1-128 | see normalization below                                   |
| `expiresAt`     | no                | string           | canonical UTC          | `IsoUtcTimestampSchema`; may be in the past               |

**Secret representation.** Secrets are **UTF-8 strings only**. Binary secrets (DER certificates, raw key bytes)
must be encoded by the caller as PEM or base64 text before submission; the payload never stores binary. Rationale:
keeps JSON serialization canonical and deterministic. `secret` max 32768 chars (private keys/certs commonly exceed
`LONG_TEXT_MAX_LENGTH = 4096`, so a domain constant `CREDENTIAL_SECRET_MAX_LENGTH = 32_768` is used; the **total**
payload remains capped by `ENCRYPTED_PAYLOAD_MAX_BYTES = 65_536` bytes).

**Tag normalization (dedup resolved).** Tag validation: each tag is a non-blank string of 1-128 chars (same shape
as `LabelSchema`). Duplicates are **canonicalized by removing later duplicates (case-sensitive, first occurrence
wins)**, not rejected. Rationale: tags are set-like; silent dedup is the least surprising and avoids a hard error
on harmless input. This is documented, deterministic, and covered by a test (D-wide). Trims leading/trailing
whitespace before comparison? **No** - tags are compared and stored exactly as provided (after blank-rejection) to
avoid surprising content changes; only exact duplicates are removed.

**Optional-field semantics.** With `exactOptionalPropertyTypes`, `undefined` means "absent"; there is no `null` for
payload fields. The canonical serializer emits keys in a fixed order and **omits** absent optional keys.

**Size enforcement.** After `serializeCredentialPayload`, the byte length (via `TextEncoder`) must be
<= `ENCRYPTED_PAYLOAD_MAX_BYTES`; otherwise `InvalidCredentialPayloadError`. Field-level bounds above make this
catchable earlier, but the byte check is authoritative.

### 5.5 `@aegis/domain` - use cases (constructor injection + `execute`)

```ts
export class InitializeVault {
	constructor(deps: {
		vaultRepository: VaultRepositoryPort;
		sessionManager: VaultSessionManager;
		crypto: VaultCryptoPort;
		clock: Clock;
		ids: IdGenerator;
		keyEnvelopePurpose: string;
	});
	execute(input: {
		passphrase: string;
		vaultId?: string;
	}): Promise<{ vaultId: string; runtimeState: 'unlocked' | 'locked' }>;
}
export class UnlockVault {
	execute(input: {
		vaultId: string;
		passphrase: string;
	}): Promise<{ vaultId: string; status: 'unlocked' }>;
}
export class LockVault {
	execute(input: { vaultId: string }): Promise<{ vaultId: string; status: 'locked' }>;
}
export class GetVaultStatus {
	execute(input: {
		vaultId: string;
	}): Promise<{ status: 'uninitialized' | 'locked' | 'unlocked'; vaultId: string | null }>;
}

export class CreateCredential {
	execute(input: {
		vaultId: string;
		payload: CredentialPayloadInput;
	}): Promise<{ id: string; createdAt: string; updatedAt: string; payload: CredentialPayload }>;
}
export class GetCredential {
	execute(input: {
		vaultId: string;
		id: string;
	}): Promise<{ id: string; createdAt: string; updatedAt: string; payload: CredentialPayload }>;
}
export class ListCredentials {
	execute(input: { vaultId: string; limit?: number; cursor?: string | null }): Promise<{
		items: Array<{ id: string; createdAt: string; updatedAt: string; payload: CredentialPayload }>;
		nextCursor: string | null;
	}>;
}
export class UpdateCredential {
	execute(input: {
		vaultId: string;
		id: string;
		payload: CredentialPayloadInput;
	}): Promise<{ id: string; updatedAt: string; payload: CredentialPayload }>;
}
export class DeleteCredential {
	execute(input: { vaultId: string; id: string }): Promise<{ id: string; deleted: true }>;
}
```

Every `execute` has an explicit return type (required for `isolatedDeclarations`).

### 5.6 Crypto composition (finding 6)

The domain defines `VaultCryptoPort`; the **composition root** implements it by forwarding to `@aegis/crypto`.
The `VaultSession` returned by crypto is handed, unchanged and opaque, to `DefaultVaultSessionManager`. Domain code
never sees a DEK/KEK.

```ts
// apps/server/src/composition/crypto-vault-port.ts   (adapter over the narrowed crypto public API)
import { createVaultSession, unlockVaultSession, validateVaultKeyEnvelope } from '@aegis/crypto';
import type { VaultKeyEnvelope, VaultSession } from '@aegis/crypto';
import type { VaultCryptoPort } from '@aegis/domain';

export function createCryptoVaultPort(): VaultCryptoPort {
	return {
		createVaultSession: async (input: { vaultId: string; passphrase: string }) => {
			const { envelope, session } = await createVaultSession(input);
			return { envelope, session };
		},
		unlockVaultSession: (input: { vaultId: string; passphrase: string; envelope: unknown }) =>
			unlockVaultSession(input),
		validateEnvelope: (input: unknown): VaultKeyEnvelope => validateVaultKeyEnvelope(input),
	};
}
```

```ts
// apps/server/src/composition/aegis-container.ts   (object graph; no HTTP)
export function createAegisContainer(deps: { database: Database; clock: Clock; ids: IdGenerator }) {
	const vaultRepository = new DrizzleVaultRepository(deps.database);
	const credentialRepository = new DrizzleVaultRecordRepository(deps.database);
	const crypto = createCryptoVaultPort();
	const sessions = new DefaultVaultSessionManager();
	const keyEnvelopePurpose = PRIMARY_KEY_ENVELOPE_PURPOSE; // 12 R3

	return {
		initializeVault: new InitializeVault({
			vaultRepository,
			sessionManager: sessions,
			crypto,
			clock: deps.clock,
			ids: deps.ids,
			keyEnvelopePurpose,
		}),
		unlockVault: new UnlockVault({
			vaultRepository,
			sessionManager: sessions,
			crypto,
			keyEnvelopePurpose,
		}),
		lockVault: new LockVault({ sessionManager: sessions }),
		getVaultStatus: new GetVaultStatus({ vaultRepository, sessionManager: sessions }),
		createCredential: new CreateCredential({
			credentialRepository,
			sessionManager: sessions,
			clock: deps.clock,
			ids: deps.ids,
		}),
		getCredential: new GetCredential({ credentialRepository, sessionManager: sessions }),
		listCredentials: new ListCredentials({ credentialRepository, sessionManager: sessions }),
		updateCredential: new UpdateCredential({
			credentialRepository,
			sessionManager: sessions,
			clock: deps.clock,
		}),
		deleteCredential: new DeleteCredential({ credentialRepository, sessionManager: sessions }),
	};
}
```

**Testability (domain stays crypto-free at test time).** Domain unit tests inject a `FakeVaultCryptoPort` whose
`FakeVaultSession` stores bytes in memory and implements the same `VaultSession` interface - no Argon2, no
`@aegis/crypto` runtime. The real adapter above is exercised only by the PostgreSQL vertical-slice test.

```ts
// test-only fake (illustrative)
class FakeVaultSession implements VaultSession {
	isDisposed = false;
	readonly store = new Map<string, Uint8Array>();
	constructor(readonly vaultId: string) {}
	encryptRecord({ recordId, plaintext }: { recordId: string; plaintext: Uint8Array }) {
		const nonce = new Uint8Array(24).fill(this.store.size + 1);
		this.store.set(recordId, plaintext.slice());
		return { encryptionVersion: 1, nonce, ciphertext: plaintext.slice() };
	}
	decryptRecord({
		recordId,
	}: {
		recordId: string;
		encryptionVersion: number;
		nonce: Uint8Array;
		ciphertext: Uint8Array;
	}) {
		const v = this.store.get(recordId);
		if (!v) throw new Error('not found');
		return v.slice();
	}
	dispose() {
		this.isDisposed = true;
		this.store.clear();
	}
}
```

---

## 6. File-by-file change inventory

> **A** = add, **M** = modify, **P** = proposal path (may be reshaped).

### 6.1 `@aegis/crypto`

| File                                                                                       | Op  | Change / reason                                                                       |
| ------------------------------------------------------------------------------------------ | --- | ------------------------------------------------------------------------------------- |
| `src/records/record-encryption.ts`                                                         | A   | **Internal** record AEAD, AAD encoder, version/size constants. Not exported from `.`. |
| `src/session/vault-session.ts`                                                             | A   | Public `VaultSession` interface + internal `#private` implementation class.           |
| `src/vault/create-vault-session.ts`                                                        | A   | Create key material **and** return envelope + live session.                           |
| `src/vault/unlock-vault-session.ts`                                                        | A   | Validate envelope -> derive KEK -> unwrap DEK -> session.                             |
| `src/errors.ts`                                                                            | M   | Add `SessionDisposedError`, `RecordSizeError`.                                        |
| `src/index.ts`                                                                             | M   | Export the narrowed public surface (5.1); **remove** low-level key primitives.        |
| `README.md`                                                                                | M   | Document session lifecycle, record format, AAD, disposal, and the narrowed surface.   |
| `src/session/*.test.ts`, `src/records/*.test.ts`, `src/vault/unlock-vault-session.test.ts` | A   | New tests (9.1).                                                                      |

### 6.2 `@aegis/database`

| File                                | Op  | Change / reason                                                                                                                                                                                                                                         |
| ----------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/repositories/vaults.ts`        | M   | Add `getActiveKeyEnvelope(vaultId, purpose)` (non-revoked, `ORDER BY created_at DESC LIMIT 1`). `initializeVaultWithKeyEnvelopes` stays atomic (already is). Multi-vault: no "first vault" helper.                                                      |
| `src/repositories/vault-records.ts` | M   | Vault-scope `getRecordById(vaultId, id)`; add `listRecordsByVault(vaultId, {limit, after})` (keyset, 7.3); vault-scope `deleteRecord(vaultId, id): Promise<boolean>`. Normalize timestamps to canonical ISO UTC at the boundary **[to verify format]**. |
| `src/index.ts`                      | M   | Export any new repository method types.                                                                                                                                                                                                                 |
| `src/schema/*.ts`, `drizzle/*`      | -   | **No migration required** (7).                                                                                                                                                                                                                          |
| `src/integration.test.ts`           | M   | Update fixtures (status lifecycle-only, `recordType` = constant, purpose constant, scoped method names); add envelope-selection, scoping, pagination, timestamp-format, and physical-delete tests.                                                      |

### 6.3 `@aegis/domain`

| File                                             | Op  | Change / reason                                                                            |
| ------------------------------------------------ | --- | ------------------------------------------------------------------------------------------ |
| `src/errors/domain-errors.ts`                    | A   | Typed domain errors (8.3).                                                                 |
| `src/ports/vault-repository.ts`                  | A   | Vault persistence port (multi-vault).                                                      |
| `src/ports/credential-repository.ts`             | A   | Credential persistence port.                                                               |
| `src/ports/vault-crypto.ts`                      | A   | Narrow crypto behaviour port (testability).                                                |
| `src/ports/runtime.ts`                           | A   | `Clock`, `IdGenerator`.                                                                    |
| `src/credentials/credential-payload.ts`          | A   | Payload type, Zod schema, canonical serialize/parse, size + tag rules (5.4.1).             |
| `src/credentials/credential-kind.ts`             | A   | `CredentialKind` union + `ENCRYPTED_RECORD_TYPE = 'encrypted_payload'`.                    |
| `src/credentials/credential-cursor.ts`           | A   | Opaque cursor encode/decode with strict validation (7.3).                                  |
| `src/sessions/vault-session-manager.ts`          | A   | Instance-scoped registry + lock concurrency.                                               |
| `src/use-cases/vault/initialize-vault.ts`        | A   | `InitializeVault`.                                                                         |
| `src/use-cases/vault/unlock-vault.ts`            | A   | `UnlockVault`.                                                                             |
| `src/use-cases/vault/lock-vault.ts`              | A   | `LockVault`.                                                                               |
| `src/use-cases/vault/get-vault-status.ts`        | A   | `GetVaultStatus`.                                                                          |
| `src/use-cases/credentials/create-credential.ts` | A   | `CreateCredential`.                                                                        |
| `src/use-cases/credentials/get-credential.ts`    | A   | `GetCredential`.                                                                           |
| `src/use-cases/credentials/list-credentials.ts`  | A   | `ListCredentials`.                                                                         |
| `src/use-cases/credentials/update-credential.ts` | A   | `UpdateCredential`.                                                                        |
| `src/use-cases/credentials/delete-credential.ts` | A   | `DeleteCredential`.                                                                        |
| `src/index.ts`                                   | M   | Export only intended public surface (use cases + their I/O types, errors, ports, manager). |
| `package.json`                                   | M   | Add deps `@aegis/crypto`, `@aegis/contracts`, `zod`.                                       |
| `src/index.test.ts`                              | M   | Replace placeholder with real behavioural tests (or delete in favour of per-file tests).   |
| `*.test.ts` (per module)                         | A   | Unit tests (9.2).                                                                          |
| `README.md`                                      | A   | Document domain boundaries, ports, session policy (file is listed but absent).             |

### 6.4 `apps/server` (composition root - no HTTP)

| File                                     | Op  | Change / reason                                                                                   |
| ---------------------------------------- | --- | ------------------------------------------------------------------------------------------------- |
| `src/composition/crypto-vault-port.ts`   | A   | `VaultCryptoPort` adapter over the narrowed crypto API (5.6).                                     |
| `src/composition/aegis-container.ts`     | A   | Build the object graph (Drizzle repos + crypto adapter + session manager + use cases). No routes. |
| `src/vertical-slice.integration.test.ts` | A   | Real crypto + domain + PostgreSQL end-to-end test (9.4), gated on `DATABASE_URL`.                 |
| `package.json`                           | M   | Add `@aegis/crypto`, `@aegis/domain`, `@aegis/database` (devDependencies for now).                |

> Alternative placement for the vertical-slice test: `packages/domain/src/vertical-slice.integration.test.ts`. The
> server is preferred because it is the genuine composition root and keeps `@aegis/database` out of the domain
> package's dependency graph. **Decision (12 R18).**

### 6.5 `@aegis/contracts` (optional, decision)

No change required. If the reviewer prefers a shared `CredentialKind`/payload schema, add
`src/credentials/credential-payload.ts` there instead and have domain import it. Default recommendation: **domain
owns the payload schema** (it is an at-rest business invariant, not a wire contract).

---

## 7. Database / schema / migration implications

### 7.1 No migration required

- The all-metadata-encrypted policy is satisfied by writing the constant `record_type = 'encrypted_payload'` and
  placing `CredentialKind` + every metadata field inside the ciphertext. Existing columns, indexes, and the partial
  unique envelope index remain valid.
- `deleted_at` is retained for compatibility; domain CRUD performs **physical** deletes and never writes it.
- `vaults.status` becomes durable-lifecycle-only (proposed `'initialized'`); `'locked'`/`'unlocked'` are never
  persisted. Existing test fixtures writing `'locked'` must be updated (a test change, not a schema change).
- `vault_key_envelopes.purpose` stays text; one canonical purpose for this milestone. "Active envelope" selection =
  the single non-revoked row matching the purpose.

### 7.2 Multi-vault compatibility

The plural `vaults` table and per-`(vault_id, purpose)` envelope uniqueness already model multiple vaults; the plan
uses them as-is. Each vault has at most one process-local session (keyed by `vaultId`). Initialization takes a
`vaultId` (generated if omitted) and relies on the primary key / partial-unique index for concurrency safety; no
"check-then-insert on a singleton" pattern.

### 7.3 Pagination specification (finding 5)

**Keyset model.** Order `(created_at ASC, id ASC)`; cursor = the last row of the previous page. Fetch `limit + 1`
rows to compute `hasMore`; return the first `limit`.

**Cursor encoding.** `encodeCursor({ createdAt, id }) => base64url(JSON.stringify({ v: 1, createdAt, id }))`.

**Cursor decoding + strict validation** (`decodeCredentialCursor`):
1. Reject if `cursor` length > `CURSOR_MAX_LENGTH` (512) or contains non-base64url characters.
2. Base64url-decode with a **bounded decode**: reject if the decoded byte length > `CURSOR_DECODED_MAX_BYTES`
   (proposed 256) before parsing.
3. `JSON.parse`; reject non-objects, arrays, and unknown keys (`strictObject`).
4. Validate `v === 1` (literal); `createdAt` via `IsoUtcTimestampSchema`; `id` via `EntityIdSchema`.
5. Any failure -> `InvalidCursorError` -> `VALIDATION_ERROR`. Never silently ignore a malformed cursor.

**Timestamp precision (consistency).** The domain `Clock` produces millisecond-precision canonical UTC
(`new Date().toISOString()`). The repository must return the same canonical form. Whether the pg driver already
returns that form for `timestamp(..., { mode: 'string' })` is **[to verify]** against the running database; if it
returns a different shape (e.g. `... 12:46:56.123+00`), the repository normalizes with
`new Date(value).toISOString()` at the port boundary. A database integration test asserts the round-trip is
canonical and ms-precision. Because values are always ms-precision, the cursor string equals the stored value, so
the `eq(created_at)` branch of the keyset predicate is exact.

**Keyset predicate + ordering (matching semantics).**

```ts
where(
	and(
		eq(vaultRecords.vaultId, vaultId),
		after
			? or(
					gt(vaultRecords.createdAt, after.createdAt),
					and(eq(vaultRecords.createdAt, after.createdAt), gt(vaultRecords.id, after.id)),
				)
			: undefined,
	),
)
	.orderBy(asc(vaultRecords.createdAt), asc(vaultRecords.id))
	.limit(limit + 1);
```

**Index adequacy (no speculative migration).** `vault_records_vault_id_idx` supports the `vault_id` filter. The
`(created_at, id)` sort is applied after the vault-scoped filter; for a local single-user vault with bounded pages
this is adequate. A future composite `(vault_id, created_at, id)` index would optimize large-vault listing but is
**not** added now (no evidence of need; avoids an unnecessary migration). This is documented as a known,
deliberate limitation.

---

## 8. Security invariants and failure handling

### 8.1 Security invariants

1. **Encrypt everything.** `CredentialKind`, name, username, secret, URL, notes, tags, expiry, and schema version
   all live inside the ciphertext. No plaintext metadata columns. `record_type` is a constant discriminator.
2. **Authenticated encryption with fresh nonce per operation.** XChaCha20-Poly1305, 24-byte random nonce,
   16-byte tag; updates re-encrypt with a fresh nonce.
3. **AAD context binding.** Length-prefixed, domain-separated AAD over `{ label, vaultId, recordId,
   encryptionVersion }`. A ciphertext moved to another vault/record fails authentication.
4. **Two distinct versions.** `RECORD_ENCRYPTION_VERSION` (crypto, stored in `encryption_version`) !=
   `CREDENTIAL_PAYLOAD_SCHEMA_VERSION` (plaintext). Never conflated.
5. **Bounded inputs.** Envelope/KDF bounds; serialized plaintext <= `ENCRYPTED_PAYLOAD_MAX_BYTES` UTF-8 bytes;
   ciphertext <= plaintext + 16; per-field bounds (5.4.1); tags <= 32 x 128; list `limit` <= `PAGINATION_MAX_LIMIT`;
   cursor decoded bytes <= 256.
6. **Narrowed key surface (post-change).** After the 2.4/5.1 narrowing, the public `.` entry exposes **no**
   raw-DEK/KEK-returning operation; record AEAD and key primitives are package-internal. Sessions hold keys in
   `#private` fields and are not serializable. (This claim is **contingent on the change landing** - see 2.4.)
7. **No runtime state persisted.** Lock/unlock are in-memory only; restart ⇒ locked.
8. **Best-effort wiping only.** `dispose()`/`clean()` are documented as non-guaranteed erasure.
9. **Fail closed.** Malformed payloads, auth failures, unsupported versions, disposed sessions, and malformed
   cursors all throw typed errors; nothing partial is returned.
10. **No secret leakage.** Errors/logs carry safe ids and failure categories only.

### 8.2 Failure handling at subsystem boundaries

| Failure                                               | Required behaviour                                                                                                                                          |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crypto initialization fails                           | No vault persisted, no session registered.                                                                                                                  |
| Database initialization fails                         | Transaction rolls back; dispose the new session; `PersistenceError`.                                                                                        |
| **DB commit succeeds but session registration fails** | Dispose the new session; vault remains durable and recoverable via unlock; `InitializeVault` returns `runtimeState: 'locked'`. Never report a live session. |
| Concurrent init with same `vaultId`                   | Unique violation on commit -> `VaultAlreadyInitializedError`; losing session disposed.                                                                      |
| Concurrent `register` for same vault                  | Check-and-set: one wins; loser throws `SessionRegistrationConflictError` and disposes.                                                                      |
| Envelope retrieval fails/absent                       | No session; `InvalidKeyEnvelopeError`.                                                                                                                      |
| Unlock authentication fails                           | No session; generic `UnlockRejectedError` (no password/tamper oracle).                                                                                      |
| Payload validation fails                              | Nothing persisted; `InvalidCredentialPayloadError`.                                                                                                         |
| Cursor invalid                                        | `InvalidCursorError`; nothing queried.                                                                                                                      |
| Encryption fails/oversize                             | Nothing persisted; `InvalidCredentialPayloadError`/`RecordSizeError`.                                                                                       |
| Create/update write fails                             | Failure returned; never a success shape.                                                                                                                    |
| Read returns malformed ciphertext                     | `CredentialDecryptionError`; never unauthenticated data.                                                                                                    |
| Delete fails / row absent                             | `CredentialNotFoundError`; never claim deleted.                                                                                                             |
| Operation races lock                                  | New ops rejected (`VaultLockedError`); lock drains in-flight.                                                                                               |
| Process exits                                         | Sessions gone; durable ciphertext remains.                                                                                                                  |

### 8.3 Error model

| Domain error (proposal)            | Meaning                                   | External `ErrorCode`             |
| ---------------------------------- | ----------------------------------------- | -------------------------------- |
| `VaultAlreadyInitializedError`     | init when vault id already exists         | `CONFLICT`                       |
| `VaultNotFoundError`               | unknown vault id                          | `NOT_FOUND`                      |
| `VaultLockedError`                 | no usable session                         | `VAULT_LOCKED`                   |
| `VaultAlreadyUnlockedError`        | unlock while unlocked                     | `CONFLICT`                       |
| `SessionRegistrationConflictError` | concurrent/duplicate session registration | `CONFLICT`                       |
| `UnlockRejectedError`              | wrong passphrase / tamper                 | `UNAUTHENTICATED`                |
| `InvalidKeyEnvelopeError`          | malformed/absent envelope                 | `NOT_FOUND` / `VALIDATION_ERROR` |
| `UnsupportedEncryptionFormatError` | unsupported version                       | `VALIDATION_ERROR`               |
| `CredentialNotFoundError`          | missing/out-of-scope record               | `NOT_FOUND`                      |
| `InvalidCredentialPayloadError`    | schema/size violation                     | `VALIDATION_ERROR`               |
| `InvalidCursorError`               | malformed pagination cursor               | `VALIDATION_ERROR`               |
| `CredentialDecryptionError`        | integrity/auth failure                    | `VALIDATION_ERROR`               |
| `PersistenceError`                 | adapter/database failure                  | `INTERNAL_ERROR`                 |

Domain defines its own typed error hierarchy (base `DomainError` with a `code`), reusing the `packages/contracts`
code names; the **server** maps to `ErrorResponse` via `safeMessageForCode`. Domain does not duplicate the
contracts error system.

---

## 9. Test matrix with concrete acceptance criteria

> Existing framework only (Vitest workspace + `describe.skipIf(!DATABASE_URL)`). No new framework.

### 9.1 Crypto unit tests (`packages/crypto/src/**`)

| #   | Test                      | Criterion                                                                                                                        |
| --- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| C1  | `createVaultSession`      | returns validated v1 envelope + usable session (round-trip encrypt/decrypt).                                                     |
| C2  | Correct passphrase unlock | `unlockVaultSession` returns a session that decrypts a known record.                                                             |
| C3  | Wrong passphrase          | throws `AuthenticationError`; no session produced.                                                                               |
| C4  | Malformed envelope        | throws `EnvelopeValidationError`/`MalformedInputError` before KDF.                                                               |
| C5  | Unsupported version       | throws `UnsupportedVersionError`.                                                                                                |
| C6  | Ciphertext tamper         | `decryptRecord` throws `AuthenticationError`.                                                                                    |
| C7  | AAD context binding       | ciphertext moved to another `vaultId`/`recordId` fails authentication.                                                           |
| C8  | Fresh nonces              | two encryptions of identical plaintext produce different nonces/ciphertexts.                                                     |
| C9  | Disposal                  | `dispose()` twice is safe; subsequent encrypt/decrypt throw `SessionDisposedError`.                                              |
| C10 | Size bounds               | plaintext > max rejected (`RecordSizeError`); ciphertext length validated on decrypt.                                            |
| C11 | No key exposure           | `JSON.stringify(session)` contains no key bytes.                                                                                 |
| C12 | AAD encoding              | `encodeRecordAad` deterministic and unambiguous for adversarial id pairs.                                                        |
| C13 | **Narrowed surface**      | `src/index.ts` exports no raw-DEK/KEK function; importing the package yields no `deriveKek`/`generateDek`/`wrapKey`/`unwrapKey`. |
| C14 | Internal AEAD not public  | `encryptRecord`/`decryptRecord` are reachable only via internal modules, not the entry.                                          |

### 9.2 Domain unit tests (fakes; **no real Argon2 or PostgreSQL**)

Use `FakeVaultCryptoPort` (5.6), an in-memory repository fake, a fixed clock, and a sequential id generator.

| #   | Test                                 | Criterion                                                                                      |
| --- | ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| D1  | Init persists then registers         | repository write observed before `register`.                                                   |
| D2  | Init DB failure                      | `PersistenceError`; session `dispose` called; nothing registered.                              |
| D3  | **Init commit + register failure**   | session disposed; result `runtimeState: 'locked'`; vault durable; `GetVaultStatus` = `locked`. |
| D4  | **Concurrent init, same id**         | exactly one succeeds; other -> `VaultAlreadyInitializedError`.                                 |
| D5  | **Concurrent init, distinct ids**    | both succeed as distinct vaults (multi-vault).                                                 |
| D6  | **Concurrent register same vault**   | one wins; loser -> `SessionRegistrationConflictError`; loser's session disposed.               |
| D7  | Unlock failure paths                 | wrong passphrase/tamper/unsupported -> typed error; `isUnlocked` stays false.                  |
| D8  | Already-unlocked unlock              | `VaultAlreadyUnlockedError` (or documented idempotent result - R6).                            |
| D9  | **Two concurrent unlocks**           | at most one session registered; loser disposes.                                                |
| D10 | Lock                                 | new ops -> `VaultLockedError`; in-flight op completes; session disposed after.                 |
| D11 | Lock idempotent                      | locking an already-locked vault resolves without error.                                        |
| D12 | Status                               | durable vault, fresh manager -> `locked`; unknown vault -> `uninitialized`.                    |
| D13 | Every credential op requires session | all five ops on a locked vault -> `VaultLockedError`.                                          |
| D14 | Vault scoping                        | `get/update/delete` with a mismatched vault id -> `CredentialNotFoundError`.                   |
| D15 | Invalid payload                      | rejected before any repository call.                                                           |
| D16 | **Tag normalization**                | >32 tags rejected; each tag <=128; exact duplicates removed (first wins).                      |
| D17 | **Secret/field bounds**              | over-long secret/name/url/notes rejected; total bytes > 65536 rejected.                        |
| D18 | **Optional semantics**               | absent optionals omitted from canonical bytes; no `null` accepted.                             |
| D19 | Failed write                         | create/update repository failure -> `PersistenceError`, no success shape.                      |
| D20 | **Cursor validation**                | malformed/oversized/non-base64url/wrong-version cursor -> `InvalidCursorError`.                |
| D21 | Pagination                           | bounded limit, deterministic order, correct `nextCursor`, no overlap.                          |
| D22 | Corrupt record in page               | all-or-nothing: whole list rejects.                                                            |
| D23 | Fresh nonce on update                | update calls `encryptRecord` again (assert nonce differs).                                     |
| D24 | Error/log hygiene                    | thrown errors/`JSON` contain no secret markers.                                                |
| D25 | AAD identity                         | `recordId` passed to `encryptRecord` equals the persisted row id.                              |

### 9.3 Database integration tests (PostgreSQL-gated)

| #   | Test                        | Criterion                                                              |
| --- | --------------------------- | ---------------------------------------------------------------------- |
| B1  | Atomic init                 | vault + envelope committed together.                                   |
| B2  | Rollback mid-init           | forced failure leaves no vault/envelope rows.                          |
| B3  | **Concurrent init same id** | one commits; other returns a unique-conflict error.                    |
| B4  | Active envelope selection   | revoked/other-purpose rows ignored; returns the non-revoked match.     |
| B5  | Vault-scoped read           | record of vault A not returned for vault B.                            |
| B6  | Listing scope/order/limit   | only vault rows, ordered `(created_at, id)`, respect limit + `after`.  |
| B7  | **Timestamp round-trip**    | returned `created_at`/`updated_at` are canonical ms-precision ISO UTC. |
| B8  | Update persists             | new nonce/ciphertext + `updated_at` change.                            |
| B9  | Physical delete             | row count goes to zero (no soft delete).                               |
| B10 | Error propagation           | unique/FK failures map to stable errors.                               |
| B11 | Ciphertext-only             | stored `nonce`/`ciphertext` present; markers absent (see 9.4).         |

### 9.4 Required end-to-end vertical slice (`apps/server/...`, PostgreSQL-gated)

Uses the **real** crypto session API, **real** domain use cases, and **real** Drizzle repositories.
1. Initialize a vault with a passphrase.
2. Create a credential whose every sensitive field contains a distinctive marker
   (`TEST_SECRET_MARKER_7c91`, `TEST_PRIVATE_NOTE_MARKER_4d28`, `TEST_TAG_MARKER_8b35`, plus name/username/url/expiry markers).
3. Inspect the raw DB row: markers **absent** from every column; `nonce`+`ciphertext` present;
   `record_type === 'encrypted_payload'`.
4. Retrieve and assert all fields round-trip.
5. List with pagination and assert deterministic order + payloads.
6. Update and assert new values (and a fresh nonce).
7. Attempt cross-vault access -> rejected (and decrypting under the wrong session fails authentication).
8. Lock -> all credential ops fail with `VaultLockedError`.
9. Unlock from the persisted envelope -> success.
10. Retrieve the updated credential.
11. Delete -> row absent.
12. New `DefaultVaultSessionManager` (simulated restart) -> status `locked`.
13. Wrong passphrase, tampered ciphertext, malformed payload, unsupported version -> no secrets exposed, no session.

Fixtures are synthetic only; no real credentials/passphrases/key material committed.

---

## 10. Phase dependencies and recommended PR breakdown

Dependency order (from the brief, refined):

```
0 Reconnaissance & design lock            (this document)
1 Crypto session + record encryption      - depends on nothing
2 Database repository extensions          - independent of 1
3 Domain errors + ports + session manager - depends on 1 (types only)
4 Vault use cases                         - depends on 2, 3
5 Credential use cases                    - depends on 2, 3, 4 (session)
6 Cross-package vertical slice            - depends on 1,2,3,4,5 + apps/server composition
7 Verification & audit                    - depends on all
```

**Recommended PR strategy** (repo history uses one focused PR per package: `#1` crypto, `#2` contracts, `#3`
database):
- **PR A - crypto session & record encryption** (Phase 1). Includes the public-surface narrowing (2.4) and
  self-contained tests.
- **PR B - database vault-scoped + envelope retrieval** (Phase 2). Independent of A.
- **PR C - domain layer** (Phases 3-5 + exports + unit tests). Depends on A+B.
- **PR D - composition root + vertical slice + verification** (Phases 6-7). Depends on C.

A and B may proceed in parallel; C is the integration point. This keeps each PR's blast radius consistent with the
existing history.

---

## 11. Root and package verification commands

Run after approval (none executed during planning):

```powershell
# Workspace hygiene (also required after adding domain/server dependencies -> lockfile update)
pnpm install

# Full local gate
pnpm lint
pnpm format:check
pnpm typecheck
pnpm build
pnpm test

# Database-backed tests (uses .env DATABASE_URL; Postgres verified reachable locally)
pnpm --filter @aegis/database db:migrate
pnpm --filter @aegis/database test          # runs src/integration.test.ts
pnpm --filter @aegis/server test            # runs the vertical-slice test (after PR D)
pnpm --filter @aegis/domain test
pnpm --filter @aegis/crypto test

# Everything at once
pnpm check
```

Notes:
- `turbo` `test`/`typecheck` depend on `^build`, so a full `pnpm test` builds upstream packages first. Running a
  single package's `vitest` directly without a prior `pnpm build` may fail to resolve `@aegis/*` `dist` imports -
  run `pnpm build` first.
- Only `.github/workflows/database.yml` exists; crypto/domain changes are not CI-covered unless a workflow is added
  (**out of scope**; flag if desired).

---

## 12. Remaining decisions, risks, and blockers

Each item below is **not** silently decided; a recommendation is given. Items marked **(!)** genuinely need reviewer
sign-off.

| #   | Decision                           | Recommendation                                                                                                                                                       | Rationale / risk                                                                                                                                                                          |
| --- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Crypto public surface**          | **Deliberately narrow**: remove raw-key primitives from the public `.` entry; expose only the session API + envelope validation + types/constants/errors (2.4, 5.1). | On current `master` these ARE public; narrowing is safe (nothing imports crypto cross-package **[verified]**). (!) Confirm the narrowing (or choose "keep for compatibility + document"). |
| R2  | **Multi-vault**                    | **Preserve multi-vault**; one session per vault; init takes/generates `vaultId`; no singleton constraint.                                                            | Schema is already plural; prior direction is multi-vault.                                                                                                                                 |
| R3  | **Init commit + register failure** | Return `runtimeState: 'locked'`; vault durable and recoverable.                                                                                                      | Honest: durable init succeeded; no live session claimed.                                                                                                                                  |
| R4  | **Credential kind set / fields**   | 8 kinds; required `{type,name,secret}`; optional `{username,url,notes,tags,expiresAt}` (5.4.1).                                                                      | Uniform, minimal shape.                                                                                                                                                                   |
| R5  | **Secret representation**          | UTF-8 string only; binary must be PEM/base64-encoded by caller; max 32768 chars.                                                                                     | Deterministic JSON; supports keys/certs.                                                                                                                                                  |
| R6  | **Tag dedup + bounds**             | <=32 tags, 1-128 chars; dedup exact duplicates (first wins, case-sensitive).                                                                                         | Set-like; least surprising. (!) Confirm reject-vs-dedup.                                                                                                                                  |
| R7  | **Payload limits**                 | Plaintext <= 65536 UTF-8 bytes; ciphertext <= +16.                                                                                                                   | Reuses `ENCRYPTED_PAYLOAD_MAX_BYTES`.                                                                                                                                                     |
| R8  | **Envelope purpose**               | `'primary'` (platform-agnostic).                                                                                                                                     | Existing tests use `'primary_windows'`; change = 4 fixture lines. (!) Confirm.                                                                                                            |
| R9  | **Envelope selection**             | `revoked_at IS NULL` + matching `purpose`, `ORDER BY created_at DESC LIMIT 1`.                                                                                       | Matches the partial-unique index.                                                                                                                                                         |
| R10 | **Unlock while unlocked**          | Reject with `VaultAlreadyUnlockedError` (`CONFLICT`).                                                                                                                | Deterministic; avoids re-deriving KDF. (!) Security-relevant.                                                                                                                             |
| R11 | **Lock vs in-flight**              | Flip to `locking` (reject new `run`), drain in-flight, dispose, unregister; idempotent.                                                                              | Simple; no general concurrency framework.                                                                                                                                                 |
| R12 | **Pagination**                     | Keyset `(created_at ASC, id ASC)`, opaque cursor, strict bounded decode, `limit` 1..100 default 20 (7.3).                                                            | Deterministic; reuses contracts bounds.                                                                                                                                                   |
| R13 | **Listing corruption**             | All-or-nothing page.                                                                                                                                                 | Brief's stated preference.                                                                                                                                                                |
| R14 | **Concurrent updates**             | Last-write-wins; **no** version column this milestone.                                                                                                               | No version column; single-user local app. (!) Confirm deferral.                                                                                                                           |
| R15 | **`record_type` value**            | Constant `'encrypted_payload'`.                                                                                                                                      | Encryption policy without migration.                                                                                                                                                      |
| R16 | **Durable vault status**           | `'initialized'` only; never `locked`/`unlocked`.                                                                                                                     | Runtime state is process-local; existing test must change.                                                                                                                                |
| R17 | **Deletion**                       | Physical `DELETE`; `deleted_at` retained unused.                                                                                                                     | Brief's policy.                                                                                                                                                                           |
| R18 | **Domain deps / slice location**   | Domain deps = `@aegis/crypto` (types), `@aegis/contracts`, `zod`; **not** `@aegis/database`. Vertical-slice test in `apps/server`.                                   | Clean boundary; server is the composition root. (!) Confirm location.                                                                                                                     |
| R19 | **Timestamp normalization**        | Repository returns canonical ms-precision ISO UTC; normalize if the driver differs.                                                                                  | **[to verify]** shape during implementation; test B7 covers it.                                                                                                                           |
| R20 | **Composite listing index**        | **Not** added.                                                                                                                                                       | Avoids a speculative migration; documented limitation.                                                                                                                                    |
| R21 | **Restart simulation**             | New `DefaultVaultSessionManager` in the same test process.                                                                                                           | No session persistence exists to restore.                                                                                                                                                 |

**Risks / blockers**
- **No CI for crypto/domain** - verification relies on local `pnpm check` + local PostgreSQL.
- **`isolatedDeclarations`** - domain's public API must have explicit annotations or `tsdown` dts build fails even
  though `tsc --noEmit` passes.
- **Argon2 test cost** - domain unit tests must use `FakeVaultCryptoPort`; only crypto/vertical-slice tests run real
  Argon2id (64 MiB).
- **Crypto surface narrowing is breaking for any hypothetical external consumer** - none exists in-repo
  **[verified]**, but it is a public semver change to `@aegis/crypto`.
- **Lockfile change** - adding domain/server dependencies updates `pnpm-lock.yaml`; commit with PR C/D.
- **Timestamp string format [to verify]** - see R19.

---

## 13. Definition of done

- Crypto exposes a documented, tested **narrowed** session API; no public `.` export returns raw DEK/KEK; record
  AEAD and key primitives are package-internal.
- Vault init/unlock work with persisted envelopes (multi-vault); lock/status are process-local and never persisted
  as durable status.
- Init failure windows are handled: commit + registration failure keeps the vault recoverable and disposes the
  session; concurrent init/register are race-safe and tested.
- All credential metadata is encrypted at rest; `record_type` is a constant discriminator; credential schema and
  tag rules are fully specified.
- Pagination uses strict, bounded cursor validation with canonical, ms-precision timestamps and matching keyset
  order; existing indexes deemed adequate without a new migration.
- Credential CRUD works through explicit domain use cases; every operation is vault-scoped; deletion is physical.
- Failure paths clean up sessions and propagate safe, typed errors.
- Domain unit tests + crypto/database integration tests pass; the real vertical slice passes against PostgreSQL.
- TypeScript 7.0.2 strict config, `isolatedDeclarations`, package builds, lint, format, and existing checks remain
  intact.
- Public exports and package dependencies are intentional; no out-of-scope features or speculative abstractions.
- A final report lists changed files, exact commands, observed results, remaining limitations, and blocked checks.

---

## 14. Approval checklist

Please confirm or amend the following before implementation begins:
- [ ] **Scope** - Phases 1-7 as described; four PRs (A: crypto surface+session, B: database, C: domain, D: composition+slice).
- [ ] **R1** Crypto public surface **narrowed** (raw-key primitives removed from `.`; internal AEAD) - or "keep for compatibility".
- [ ] **R2** Multi-vault preserved (no single-vault constraint; `vaultId` on init/status/unlock/lock).
- [ ] **R3** Init commit + register failure -> `runtimeState: 'locked'`, vault recoverable.
- [ ] **R4-R6** Credential kinds/fields/secret representation/tag dedup as specified (5.4.1).
- [ ] **R7-R9** Payload/ciphertext limits; envelope purpose `'primary'`; envelope selection rule.
- [ ] **R10** Unlock-while-unlocked rejected with `CONFLICT`.
- [ ] **R11** Lock policy = reject new ops, drain in-flight, then dispose.
- [ ] **R12-R13** Keyset pagination with strict cursor validation; all-or-nothing listing.
- [ ] **R14** No optimistic concurrency this milestone.
- [ ] **R16** Durable `vaults.status` = `'initialized'` only.
- [ ] **R18** Domain deps = `@aegis/crypto`, `@aegis/contracts`, `zod` (no `@aegis/database`); vertical-slice test in `apps/server`.
- [ ] **Exports** - final public surface of `packages/domain/src/index.ts` acceptable as proposed.

**No source, manifest, lockfile, schema, migration, test, or CI file will be modified until this checklist is
approved.**
