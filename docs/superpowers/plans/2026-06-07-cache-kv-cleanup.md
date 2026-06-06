# Cache KV Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a scheduled API endpoint that deletes expired records from the EdgeOne `cache` KV binding.

**Architecture:** A new admin server service runs cache cleanup through `DbPort.script`, keeping storage behavior behind the existing DB boundary. The EdgeOne KV adapter recognizes the cleanup script and deletes expired adapter envelopes from the `cache` binding. A new cron route schedules the service with `after()` and returns immediately like the existing cron endpoints.

**Tech Stack:** Next.js App Router route handlers, Bun, Vitest, EdgeOne KV DB adapter, TypeScript.

---

## File Structure

- Modify `src/infrastructure/db/edgeone-kv-db-adapter.ts`: add cleanup script emulation for expired adapter envelopes.
- Modify `src/modules/admin/server/cache-management-service.ts`: export `cleanupExpiredCacheKvEntries`.
- Create `src/app/api/cron/cache-cleanup/route.ts`: scheduled API route.
- Modify `tests/infrastructure/edgeone-kv-db-adapter.test.ts`: cover cleanup behavior.
- Modify `tests/modules/admin/cache-management-service.test.ts`: cover service script invocation.
- Create `tests/modules/admin/cache-cleanup-cron-route.test.ts`: cover cron scheduling.
- Create `.github/workflows/cron-cache-cleanup.yml`: optional daily scheduler matching existing cron workflow style.
- Modify `docs/operations/github-actions-cron.md`: document the fourth cron endpoint.

### Task 1: Service and Adapter Cleanup

**Files:**
- Modify: `tests/modules/admin/cache-management-service.test.ts`
- Modify: `tests/infrastructure/edgeone-kv-db-adapter.test.ts`
- Modify: `src/modules/admin/server/cache-management-service.ts`
- Modify: `src/infrastructure/db/edgeone-kv-db-adapter.ts`

- [ ] **Step 1: Write failing service test**

Add a test named `cleans expired records from the cache KV namespace` that calls `cleanupExpiredCacheKvEntries` with a fake store and deterministic clock. It should expect the store script to be called with a cleanup script, `args: ["*", 1000, 1768435200000]`, and `readOnly: false`.

- [ ] **Step 2: Run service test and verify RED**

Run: `rtk bun run test -- tests/modules/admin/cache-management-service.test.ts`

Expected: fail because `cleanupExpiredCacheKvEntries` is not exported.

- [ ] **Step 3: Write failing adapter test**

Add a test named `cleans expired entries across the cache KV binding` that stores three records with TTL envelopes, advances time, runs a cleanup script through a `namespace: ""` adapter, and expects only expired records to be deleted.

- [ ] **Step 4: Run adapter test and verify RED**

Run: `rtk bun run test -- tests/infrastructure/edgeone-kv-db-adapter.test.ts`

Expected: fail with `EdgeOne KV adapter does not support this storage script.`

- [ ] **Step 5: Implement minimal service and adapter support**

Export `cleanupExpiredCacheKvEntries` from `cache-management-service.ts`. In the adapter, add cleanup script detection before generic SCAN handling and implement scanning, envelope parsing, expiration comparison, deletion, and summary return.

- [ ] **Step 6: Run service and adapter tests and verify GREEN**

Run: `rtk bun run test -- tests/modules/admin/cache-management-service.test.ts tests/infrastructure/edgeone-kv-db-adapter.test.ts`

Expected: all tests pass.

### Task 2: Cron Route

**Files:**
- Create: `tests/modules/admin/cache-cleanup-cron-route.test.ts`
- Create: `src/app/api/cron/cache-cleanup/route.ts`

- [ ] **Step 1: Write failing cron route test**

Mock `next/server` `after()` and `cleanupExpiredCacheKvEntries`. Assert `GET()` returns `{ "message": "Cache cleanup scheduled." }`, calls `after()` once, and the callback runs the cleanup service.

- [ ] **Step 2: Run cron route test and verify RED**

Run: `rtk bun run test -- tests/modules/admin/cache-cleanup-cron-route.test.ts`

Expected: fail because the route file does not exist.

- [ ] **Step 3: Implement cron route**

Create `src/app/api/cron/cache-cleanup/route.ts` with `runtime = "nodejs"`, `GET = withApiTraffic(async function GET() { after(...); return NextResponse.json({ message: "Cache cleanup scheduled." }); })`.

- [ ] **Step 4: Run cron route test and verify GREEN**

Run: `rtk bun run test -- tests/modules/admin/cache-cleanup-cron-route.test.ts`

Expected: test passes.

### Task 3: Scheduler Docs

**Files:**
- Create: `.github/workflows/cron-cache-cleanup.yml`
- Modify: `docs/operations/github-actions-cron.md`

- [ ] **Step 1: Add workflow**

Create a daily GitHub Actions workflow that validates `CRON_BASE_URL`, calls `${CRON_BASE_URL%/}/api/cron/cache-cleanup`, and checks for `Cache cleanup scheduled.`

- [ ] **Step 2: Update operations docs**

Add `/api/cron/cache-cleanup` and `.github/workflows/cron-cache-cleanup.yml` to the cron notes.

- [ ] **Step 3: Run focused verification**

Run: `rtk bun run test -- tests/modules/admin/cache-management-service.test.ts tests/infrastructure/edgeone-kv-db-adapter.test.ts tests/modules/admin/cache-cleanup-cron-route.test.ts`

Expected: all focused tests pass.
