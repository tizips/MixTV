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

## Runtime Requirement

- Edge Runtime / Worker Runtime compatibility remains mandatory for `middleware.ts`, auth session/token validation, and request-bound infrastructure expected to run before API/page handling.
- API route handlers under `src/app/api/*` are no longer required to be Edge Runtime compatible. They may use Node.js runtime APIs and Node-only dependencies when appropriate.
- When adding or changing auth, middleware, data access, caching, crypto, or request interception that may run in Edge-like runtimes, prefer Web Platform APIs (`fetch`, `crypto.subtle`, Web Streams, standard `URL`).
- Do not introduce Node-only runtime dependencies into code paths that may be used by `middleware.ts`, auth session/token validation, or other request-bound infrastructure expected to run in Edge/Worker environments.
- If a feature cannot fully run in Edge/Worker environments, isolate the Node-only part behind a narrow server-only boundary and keep the request gating / token validation path Edge-compatible.
- Treat this as an enforceable architecture rule for Edge-bound paths only: new implementations must preserve or improve Edge/Worker compatibility where those paths are expected to run in Edge-like runtimes.

## Architecture

- The intended architecture is a single Next.js deployment with modular-monolith boundaries. The detailed rationale is in `docs/superpowers/specs/2026-05-09-mixtv-nextjs-monolith-design.md`.
- Keep business logic in `src/modules/*`; `src/app/*` should stay limited to routing, layouts, page orchestration, metadata, and global shell wiring.
- Module internals follow `domain/`, `application/`, `infrastructure/`, `server/`, `ui/`, plus `index.ts`. Other modules should import only from a module's `index.ts`, not its internals.
- `src/shared/*` is for stable cross-module contracts only. It must not import concrete modules or become a general utility dump.
- `src/integrations/*` normalizes third-party/platform data before business modules consume it. Current example: `src/integrations/tmdb/tmdb-adapter.ts`.
- `src/infrastructure/*` contains concrete adapters that implement shared ports. Current examples: in-memory storage/cache adapters.

## Storage / DB Rules

- Use `src/infrastructure/db/db-adapter.ts` and the shared `DbPort` as the storage boundary for Redis/Upstash-backed module persistence.
- Do not add specialized storage methods to the DB port or concrete DB adapters for feature-specific Redis commands.
- Direct DB operations are limited to the existing basic `get`, `set`, and `del` methods.
- Any storage behavior beyond basic `get`/`set`/`del` must use `DbPort.script`, with Lua scripts kept close to the module/service boundary that owns the behavior.
- For Redis data structures such as lists, sets, sorted sets, counters, deduplication, trimming, batch mutation, or read-modify-write flows, call the relevant Redis commands from a script instead of expanding the DB adapter API.
- Example pattern: search history uses a Redis list through `DbPort.script` with `LRANGE`, `LREM`, `LPUSH`, `LTRIM`, and `DEL`; it must not introduce a `db.list` adapter API.

## UI Conventions

- When a component, spec, or request says "icon", default to Bootstrap Icons (`bi`) unless the user explicitly asks for a different icon set.
- Use font icons for UI icons by default; do not introduce inline SVG icon markup unless explicitly requested.
- Content pages such as home, search, sources, movies, series, anime, and variety should use the shared content width: outer horizontal padding `px-4 md:px-6 lg:px-8` and an inner centered container with `w-full max-w-6xl`.
- The `/play` page is wider than standard content pages: use outer horizontal padding `px-4 md:px-6 lg:px-8`, an inner centered container with `w-full max-w-[100rem]`, and keep the playback layout's side panel around `360px` on `xl` and `380px` on `2xl` so the video area remains dominant.
- All forms should prefer AntD `Form` and `Form.Item` for field layout, and `Row` / `Col` for page-level two-column structure when needed.
- For forms, prefer AntD form values and `Form` submission handlers over manual input-state plumbing. Keep Tailwind limited to page shell, background, and other layout-only concerns when AntD does not cover them cleanly.
- When replacing a legacy form, preserve the existing field semantics, validation messages, and submit behavior, but prefer AntD-native spacing, labeling, and button sizing over custom wrappers.

## Page and API Interaction Rules

- Treat interactive pages as thin orchestration layers: pages and client panels own UI state, loading state, optimistic updates, modal behavior, and toast feedback; durable validation and business rules belong in `src/modules/*/server` or another module boundary, not only in the component.
- Every create/edit modal or drawer should define its entry action, default field values, reset behavior, dismissal behavior, loading/disabled state, and success close behavior. Reopening a create form should not preserve stale draft data unless the feature explicitly requires drafts.
- Client-side validation should cover immediate UX constraints such as required fields, matching confirmation fields, valid enum selections, and obviously invalid local input. Server-side validation remains authoritative and must repeat all security or persistence rules.
- Use Zod for page forms and API request payloads when validating structured input, especially create/edit forms, JSON route bodies, enum fields, nested objects, and shared request contracts. Keep schemas close to the boundary they validate unless a schema is intentionally shared.
- Form submissions that call JSON APIs must set `Content-Type: application/json` and send a documented, minimal request body. Reject or avoid unsupported fields instead of silently accepting accidental payload shape drift.
- API route handlers should validate valid JSON, required fields, enum values, string trimming/length rules, duplicates/conflicts, and domain-specific invariants before calling persistence; use Zod schemas where practical for request shape and field validation. Return `400` with `{ message: string }` for expected validation failures.
- Successful create endpoints should return `201` with the created public resource object unless the existing route contract says otherwise. Responses must not expose secrets, password hashes, tokens, internal storage fields, or raw credentials.
- Successful update/delete/batch endpoints should return the shape the UI needs to settle state deterministically: either the updated public resource or a normalized collection. Keep this consistent within a feature area.
- After successful mutations, prefer updating UI state from the response payload instead of guessing. Refetch the collection only when the response does not contain enough information or when server-side ordering/derived fields are important.
- Failure UX should separate local form validation from server/API failures. Local validation may render inline form errors; expected API validation errors should usually surface through toast or a designated server-error area while preserving user input and keeping the form open.
- Non-validation failures should use stable fallback messages and leave the user in a recoverable state. If an optimistic update was applied, roll it back on failure.
- Keep endpoint naming and HTTP method semantics consistent inside each feature. If a feature already has mixed contracts, preserve them until intentionally refactoring every caller, test, and route together.

## Current Baseline

- Implemented modules are still minimal: `auth`, `search`, and `playback` currently expose small public APIs/placeholders.
- Existing shared contracts: DB ports/types.
- Existing tests cover architecture folders, shared DB contracts, auth permissions, and memory adapters.
- The Phase 1 plan lives at `docs/superpowers/plans/2026-05-09-mixtv-foundation-phase1.md`; verify against current source because plan checkboxes may lag behind implemented files.

## Tooling Quirks

- TypeScript is strict with `@/*` mapped to `./src/*` in both `tsconfig.json` and `vitest.config.ts`.
- Tailwind is v4 via `@tailwindcss/postcss` in `postcss.config.mjs`.
- Do not assume TanStack Query or Zod are installed yet; they appear in architecture docs but not current `package.json`.
- `CLAUDE.md` only references this file, so keep repo-specific agent guidance here.
