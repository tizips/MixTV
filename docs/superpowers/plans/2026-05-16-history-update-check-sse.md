# History Update Check SSE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically check each `/history` item for source-side episode updates, refresh stored totals when newer episode counts exist, and stream per-item progress to the page with SSE.

**Architecture:** Keep the existing history list/delete service intact and add a dedicated update-check service beside it. The new service will read the user's playback history, skip records older than 30 days, consult a small TTL cache before calling source detail fetchers, and emit structured events for SSE. The `/history` page will open an `EventSource` on mount, update list state as events arrive, and surface a lightweight summary of update activity.

**Tech Stack:** Next.js App Router route handlers, Server Components/Client Components, Web Platform `ReadableStream` + `EventSource`, Redis-backed `DbPort` scripts, existing video source detail fetcher.

---

### Task 1: Add history update-check domain/service logic

**Files:**
- Create: `src/modules/history/server/history-update-service.ts`
- Modify: `src/modules/history/server/history-service.ts`
- Modify: `src/modules/history/index.ts`
- Test: `tests/modules/history/history-update-service.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("skips history older than 30 days and emits a skip event", async () => {
  // create one stale record and one recent record
  // expect the stale one to be skipped and only the recent one to be checked
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/modules/history/history-update-service.test.ts`
Expected: FAIL because the service does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export async function* checkHistoryUpdates(userId: string, options: HistoryUpdateOptions = {}) {
  // load history, skip stale items, use cache, fetch details when needed,
  // update stored totals when source total_episodes is larger, and yield events.
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- tests/modules/history/history-update-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/history/server/history-update-service.ts src/modules/history/server/history-service.ts src/modules/history/index.ts tests/modules/history/history-update-service.test.ts
git commit -m "feat: add history update checking service"
```

### Task 2: Add SSE route for history update checks

**Files:**
- Create: `src/app/api/history/check-updates/route.ts`
- Test: `tests/modules/history/history-update-route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("streams start, per-item update, and done events", async () => {
  // mock auth and the history update generator
  // assert the response is an SSE stream and contains the expected events
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/modules/history/history-update-route.test.ts`
Expected: FAIL because the route does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export async function GET() {
  // authenticate, create a ReadableStream, and enqueue SSE events from the generator.
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- tests/modules/history/history-update-route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/history/check-updates/route.ts tests/modules/history/history-update-route.test.ts
git commit -m "feat: stream history update checks over SSE"
```

### Task 3: Auto-run update checks from the `/history` page

**Files:**
- Modify: `src/modules/history/ui/history-page-shell.tsx`
- Modify: `src/modules/history/ui/history-page-shell.test.tsx`

- [ ] **Step 1: Write the failing test**

```ts
it("opens an EventSource and updates the rendered totals when an update event arrives", async () => {
  // mount the page shell, simulate an update event,
  // and assert the card total_episodes changes in the DOM
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- src/modules/history/ui/history-page-shell.test.tsx`
Expected: FAIL because SSE handling is not implemented yet.

- [ ] **Step 3: Write minimal implementation**

```ts
useEffect(() => {
  const eventSource = new EventSource("/api/history/check-updates");
  // update state from start/update/skip/error/done events
  // close the connection on cleanup
}, []);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- src/modules/history/ui/history-page-shell.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/history/ui/history-page-shell.tsx src/modules/history/ui/history-page-shell.test.tsx
git commit -m "feat: auto-check history updates on page load"
```
