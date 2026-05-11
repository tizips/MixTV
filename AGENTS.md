# MixTV Agent Notes

## Commands

- Use Bun by default: `bun.lock` is the authoritative lockfile. Do not generate or commit `package-lock.json`.
- Dev server: `bun run dev` on port 3000.
- Production check: `bun run build`; production start: `bun run start`.
- Lint: `bun run lint` uses ESLint flat config with `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`.
- Tests: `bun run test` runs Vitest 4 in Node environment with globals enabled.
- Focused tests: `bun run test -- tests/modules/auth/permissions.test.ts` or any specific test path.
- Typecheck has no script; use `bunx tsc --noEmit` when a standalone TS check is needed.

## Next.js 16

- This is Next.js `16.2.6` with React `19.2.4`. Do not assume older App Router APIs or file conventions.
- Before changing Next-specific APIs, check the local docs under `node_modules/next/dist/docs/` and heed deprecations.
- `src/app/` is the App Router entrypoint; there is no root `app/` directory.

## Architecture

- The intended architecture is a single Next.js deployment with modular-monolith boundaries. The detailed rationale is in `docs/superpowers/specs/2026-05-09-mixtv-nextjs-monolith-design.md`.
- Keep business logic in `src/modules/*`; `src/app/*` should stay limited to routing, layouts, page orchestration, metadata, and global shell wiring.
- Module internals follow `domain/`, `application/`, `infrastructure/`, `server/`, `ui/`, plus `index.ts`. Other modules should import only from a module's `index.ts`, not its internals.
- `src/shared/*` is for stable cross-module contracts only. It must not import concrete modules or become a general utility dump.
- `src/integrations/*` normalizes third-party/platform data before business modules consume it. Current example: `src/integrations/tmdb/tmdb-adapter.ts`.
- `src/infrastructure/*` contains concrete adapters that implement shared ports. Current examples: in-memory storage/cache adapters.

## UI Conventions

- When a component, spec, or request says "icon", default to Bootstrap Icons (`bi`) unless the user explicitly asks for a different icon set.
- Use font icons for UI icons by default; do not introduce inline SVG icon markup unless explicitly requested.

## Current Baseline

- Implemented modules are still minimal: `auth`, `search`, and `playback` currently expose small public APIs/placeholders.
- Existing shared contracts: `AppError`, `StoragePort`, `CachePort`, auth `Session`/`Permission` types.
- Existing tests cover architecture folders, shared errors/storage contract, auth permissions, and memory adapters.
- The Phase 1 plan lives at `docs/superpowers/plans/2026-05-09-mixtv-foundation-phase1.md`; verify against current source because plan checkboxes may lag behind implemented files.

## Tooling Quirks

- TypeScript is strict with `@/*` mapped to `./src/*` in both `tsconfig.json` and `vitest.config.ts`.
- Tailwind is v4 via `@tailwindcss/postcss` in `postcss.config.mjs`.
- Do not assume TanStack Query or Zod are installed yet; they appear in architecture docs but not current `package.json`.
- `CLAUDE.md` only references this file, so keep repo-specific agent guidance here.
