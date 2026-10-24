# Aegis

Aegis is a local-first, encrypted vault for securely managing passwords, API keys, access tokens, SSH keys, and other sensitive credentials. It is built with TypeScript across a pnpm/Turborepo monorepo.

## Workspace layout

- `apps/web` - Vue 3 web application
- `apps/server` - Node.js/Fastify API application
- `packages/crypto` - cryptographic primitives and key management
- `packages/database` - Drizzle ORM, PostgreSQL schema, migrations, and repositories
- `packages/contracts` - shared Zod schemas and API contracts
- `packages/domain` - framework-independent domain models and business rules
- `docs` - technical design and architecture records

## Commands

- `pnpm build` - build all packages and applications
- `pnpm lint` - run Oxlint
- `pnpm format` - format the repository with Biome
- `pnpm format:check` - check formatting without modifying files
- `pnpm typecheck` - run TypeScript checks
- `pnpm test` - run Vitest for all packages
- `pnpm test:coverage` - run tests with coverage
- `pnpm check` - run lint, formatting check, typecheck, and tests
