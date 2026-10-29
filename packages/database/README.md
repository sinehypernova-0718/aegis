# @aegis/database

Drizzle ORM schema, migrations, repositories, and PostgreSQL client utilities for Aegis.

## Implemented functionality

- PostgreSQL client creation with pooled connections and validated pool settings.
- Drizzle schema for `vaults`, `vault_key_envelopes`, and `vault_records`.
- Schema-derived selected-row and insert types: `Vault`, `NewVault`, `VaultKeyEnvelope`, `NewVaultKeyEnvelope`, `VaultRecord`, `NewVaultRecord`.
- Repository implementations for vaults and vault records.
- Transaction helper `withDatabaseTransaction`.
- Database error mapping to stable package errors.

## Environment variables

- `DATABASE_URL` or `AEGIS_DATABASE_URL` (required)
- `DATABASE_POOL_MAX` (optional, 1-1000)
- `DATABASE_IDLE_TIMEOUT_MS` (optional, 1000-600000)
- `DATABASE_CONNECT_TIMEOUT_MS` (optional, 1000-60000)

## Commands

- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `pnpm db:migrate`
- `pnpm db:check`

Tests that require PostgreSQL are skipped when `DATABASE_URL` is absent. CI provisions PostgreSQL and runs them.

## Public API

See `src/index.ts` for the deliberate export surface. Schema-derived types are also available from `@aegis/database` and `@aegis/database` schema barrel.

## Known limitations

- `vaults`/`vault_key_envelopes`/`vault_records` foreign keys are declared in SQL migrations; schema references are included.
- Integration tests require a running PostgreSQL instance.
