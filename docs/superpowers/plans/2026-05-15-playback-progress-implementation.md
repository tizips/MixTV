# Playback Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add authenticated playback progress storage for `/play`, initialize zero-progress records on first play-page access, and migrate favorites to the new route-param and snake_case metadata contract.

**Architecture:** Resource identity is always `{source}:{id}`. Favorites and playback progress each own a user-scoped EdgeOne KV hash through direct helper calls; API routes authenticate and delegate business logic to module services. `/play` remains a thin orchestration layer and receives resume state from the playback service.

**Tech Stack:** Next.js 16 App Router, React 19, Bun, Vitest 4, TypeScript, EdgeOne KV helper functions.

---

## File Structure

- Modify `src/modules/favorites/server/favorite-service.ts`: replace old `FavoriteItem` shape, route-param input, parsing, sorting, create/delete logic.
- Modify `src/app/api/favorites/route.ts`: keep authenticated list route.
- Create `src/app/api/favorites/[source]/[id]/route.ts`: authenticated create and delete route.
- Delete or stop using `src/app/api/favorite/route.ts` and `src/app/api/favorites/[favoriteKey]/route.ts`.
- Modify `src/modules/favorites/ui/favorites-page-shell.tsx`: consume new favorite fields and call route-param endpoints.
- Modify `src/modules/search/ui/search-page-shell.tsx`: create/delete favorites through route-param endpoints.
- Modify `tests/modules/favorites/favorite-service.test.ts`, `tests/modules/favorites/favorite-route.test.ts`, `src/modules/favorites/ui/favorites-page-shell.test.tsx`, and `src/modules/search/ui/search-page-shell.test.tsx`.
- Create `src/modules/playback/server/playback-progress-service.ts`: progress record types, validation, direct KV hash operations, create/update/read helpers.
- Create `src/app/api/playback/progress/[source]/[id]/route.ts`: authenticated progress update endpoint.
- Create `tests/modules/playback/playback-progress-service.test.ts` and `tests/modules/playback/playback-progress-route.test.ts`.
- Modify `src/modules/playback/domain/playback-page-data.ts`: add route identity and persisted progress metadata needed by client uploads.
- Modify `src/modules/playback/server/playback-service.ts`: authenticate-aware progress read/create integration.
- Modify `src/app/play/page.tsx`: require auth user id and pass it to playback service.
- Modify `src/modules/playback/ui/play-page-shell.tsx`: upload progress via HTTP on interval and playback events.
- Modify `tests/modules/playback/playback-service.test.ts`, `src/app/play/page.test.tsx`, and `src/modules/playback/ui/play-page-shell.test.tsx`.

## Task 1: Favorites Service Contract

**Files:**
- Modify: `src/modules/favorites/server/favorite-service.ts`
- Test: `tests/modules/favorites/favorite-service.test.ts`
- Test helper: `tests/modules/favorites/favorite-test-store.ts`

- [ ] **Step 1: Write failing favorite service tests**

Replace old expected favorite shape with:

```ts
expect(favorite).toEqual({
  cover: "https://image.test/poster.jpg",
  douban_id: 0,
  id: "100",
  original_episodes: 3,
  remarks: "更新至3集",
  save_time: 1768435200000,
  search_title: "",
  source: "alpha",
  source_name: "Alpha Source",
  title: "Alpha Movie",
  total_episodes: 3,
  year: "2026",
});
expect(JSON.parse(store.dumpHash("user:user-1:fav")["alpha:100"])).toEqual({
  cover: "https://image.test/poster.jpg",
  douban_id: 0,
  original_episodes: 3,
  remarks: "更新至3集",
  save_time: 1768435200000,
  search_title: "",
  source_name: "Alpha Source",
  title: "Alpha Movie",
  total_episodes: 3,
  year: "2026",
});
```

Add assertions that returned/stored favorites do not contain `favoriteKey`, `index`, `play_time`, or `total_time`.

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
rtk bun run test -- tests/modules/favorites/favorite-service.test.ts
```

Expected: FAIL because old service returns `favoriteKey`, camelCase fields, and ISO timestamps.

- [ ] **Step 3: Implement minimal favorite service changes**

Use these public types and helpers:

```ts
export interface StoredFavoriteRecord {
  cover: string;
  douban_id: number;
  original_episodes: number;
  remarks: string;
  save_time: number;
  search_title: string;
  source_name: string;
  title: string;
  total_episodes: number;
  year: string;
}

export type FavoriteItem = StoredFavoriteRecord & {
  id: string;
  source: string;
};

export function createFavoriteKey(source: string, id: string) {
  return `${source.trim()}:${id.trim()}`;
}

function createUserFavoriteHashKey(userId: string) {
  return `user:${userId}:fav`;
}
```

Change `now` in `FavoriteServiceOptions` to `now?: () => number`, defaulting to `Date.now()`. Build records from detail:

```ts
const episodeCount = detail.episodes.length;
const record: StoredFavoriteRecord = {
  cover: detail.posterUrl,
  douban_id: 0,
  original_episodes: episodeCount,
  remarks: detail.remarks || (episodeCount > 0 ? `更新至${episodeCount}集` : ""),
  save_time: options.now?.() ?? Date.now(),
  search_title: "",
  source_name: detail.sourceName,
  title: detail.title,
  total_episodes: episodeCount,
  year: detail.year,
};
```

Parse Redis hash fields into response identity:

```ts
function parseFavoriteEntry(field: string, rawFavorite: string): FavoriteItem | null {
  const delimiterIndex = field.indexOf(":");
  if (delimiterIndex <= 0 || delimiterIndex === field.length - 1) return null;
  const source = field.slice(0, delimiterIndex);
  const id = field.slice(delimiterIndex + 1);
  const record = parseStoredFavorite(rawFavorite);
  return record ? { source, id, ...record } : null;
}
```

Sort by `save_time` descending.

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```bash
rtk bun run test -- tests/modules/favorites/favorite-service.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/modules/favorites/server/favorite-service.ts tests/modules/favorites/favorite-service.test.ts tests/modules/favorites/favorite-test-store.ts
rtk git commit -m "refactor: store favorites as resource metadata"
```

## Task 2: Favorites API and UI Routes

**Files:**
- Create: `src/app/api/favorites/[source]/[id]/route.ts`
- Modify: `src/app/api/favorites/route.ts`
- Modify: `src/modules/favorites/ui/favorites-page-shell.tsx`
- Modify: `src/modules/search/ui/search-page-shell.tsx`
- Test: `tests/modules/favorites/favorite-route.test.ts`
- Test: `src/modules/favorites/ui/favorites-page-shell.test.tsx`
- Test: `src/modules/search/ui/search-page-shell.test.tsx`

- [ ] **Step 1: Write failing route and UI tests**

Update route tests to import:

```ts
import * as itemRoute from "@/app/api/favorites/[source]/[id]/route";
```

Expect create:

```ts
const response = await itemRoute.POST(
  new Request("http://localhost/api/favorites/alpha/100", { method: "POST" }),
  { params: Promise.resolve({ source: "alpha", id: "100" }) },
);
expect(createFavoriteMock).toHaveBeenCalledWith({ source: "alpha", id: "100" }, { userId: "user-1" });
```

Expect delete:

```ts
const response = await itemRoute.DELETE(
  new Request("http://localhost/api/favorites/alpha/100", { method: "DELETE" }),
  { params: Promise.resolve({ source: "alpha", id: "100" }) },
);
expect(deleteFavoriteMock).toHaveBeenCalledWith("user-1", { source: "alpha", id: "100" });
```

Update UI fetch expectations:

```ts
expect(fetchMock).toHaveBeenCalledWith("/api/favorites/alpha/movie-1", expect.objectContaining({ method: "DELETE" }));
expect(fetchMock).toHaveBeenCalledWith("/api/favorites/alpha/movie-1", expect.objectContaining({ method: "POST" }));
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
rtk bun run test -- tests/modules/favorites/favorite-route.test.ts src/modules/favorites/ui/favorites-page-shell.test.tsx src/modules/search/ui/search-page-shell.test.tsx
```

Expected: FAIL because route files and UI calls still use `favoriteKey` and `/api/favorite`.

- [ ] **Step 3: Implement route-param favorites API**

Create `src/app/api/favorites/[source]/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createFavorite, deleteFavorite, FavoriteValidationError } from "@/modules/favorites/server/favorite-service";

type Context = { params: Promise<{ source: string; id: string }> };

function readUserId(session: unknown) {
  const user = session && typeof session === "object" ? (session as { user?: { id?: unknown } }).user : undefined;
  return typeof user?.id === "string" ? user.id : "";
}

export async function POST(_request: Request, context: Context) {
  const userId = readUserId(await auth());
  if (!userId) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  try {
    const { source, id } = await context.params;
    return NextResponse.json({ favorite: await createFavorite({ source, id }, { userId }) }, { status: 201 });
  } catch (error) {
    if (error instanceof FavoriteValidationError) return NextResponse.json({ message: error.message }, { status: 400 });
    return NextResponse.json({ message: "Failed to create favorite." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  const userId = readUserId(await auth());
  if (!userId) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  try {
    const { source, id } = await context.params;
    return NextResponse.json({ favorites: await deleteFavorite(userId, { source, id }) });
  } catch (error) {
    if (error instanceof FavoriteValidationError) return NextResponse.json({ message: error.message }, { status: 400 });
    return NextResponse.json({ message: "Failed to delete favorite." }, { status: 500 });
  }
}
```

Update favorite UI to use `source`, `id`, `cover`, `source_name`, `total_episodes`, and `save_time`. Use `const itemKey = `${favorite.source}:${favorite.id}`` only as a React key and local pending key.

Update search UI to POST/DELETE `/api/favorites/${encodeURIComponent(result.key)}/${encodeURIComponent(result.resourceId)}`.

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```bash
rtk bun run test -- tests/modules/favorites/favorite-route.test.ts src/modules/favorites/ui/favorites-page-shell.test.tsx src/modules/search/ui/search-page-shell.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/app/api/favorites src/modules/favorites/ui/favorites-page-shell.tsx src/modules/search/ui/search-page-shell.tsx tests/modules/favorites/favorite-route.test.ts src/modules/favorites/ui/favorites-page-shell.test.tsx src/modules/search/ui/search-page-shell.test.tsx
rtk git commit -m "refactor: use route params for favorites"
```

## Task 3: Playback Progress Service and API

**Files:**
- Create: `src/modules/playback/server/playback-progress-service.ts`
- Create: `src/app/api/playback/progress/[source]/[id]/route.ts`
- Test: `tests/modules/playback/playback-progress-service.test.ts`
- Test: `tests/modules/playback/playback-progress-route.test.ts`

- [ ] **Step 1: Write failing progress service tests**

Add tests that create and update records:

```ts
const progress = await savePlaybackProgress(
  { source: "alpha", id: "100", index: 2, play_time: 1061, total_time: 1247 },
  { detailFetcher, now: () => 1768535315661, store, userId: "user-1", videoSourceStore },
);
expect(progress).toMatchObject({
  source: "alpha",
  id: "100",
  index: 2,
  play_time: 1061,
  total_time: 1247,
  save_time: 1768535315661,
});
expect(JSON.parse(store.dumpHash("user:user-1:pr")["alpha:100"])).not.toHaveProperty("source");
expect(JSON.parse(store.dumpHash("user:user-1:pr")["alpha:100"])).not.toHaveProperty("id");
```

Add validation tests for blank source/id, invalid JSON body shape via service input, negative `play_time`, and non-finite `total_time`.

- [ ] **Step 2: Write failing API route tests**

Expect:

```ts
expect(savePlaybackProgressMock).toHaveBeenCalledWith(
  { source: "alpha", id: "100", index: 2, play_time: 1061, total_time: 1247 },
  { userId: "user-1" },
);
```

Expect unauthenticated `401`, invalid JSON `400`, and validation errors as `400`.

- [ ] **Step 3: Run tests to verify RED**

Run:

```bash
rtk bun run test -- tests/modules/playback/playback-progress-service.test.ts tests/modules/playback/playback-progress-route.test.ts
```

Expected: FAIL because service and route do not exist.

- [ ] **Step 4: Implement playback progress service**

Define:

```ts
export interface StoredPlaybackProgressRecord {
  cover: string;
  douban_id: number;
  index: number;
  original_episodes: number;
  play_time: number;
  remarks: string;
  save_time: number;
  search_title: string;
  source_name: string;
  title: string;
  total_episodes: number;
  total_time: number;
  year: string;
}

export type PlaybackProgressRecord = StoredPlaybackProgressRecord & {
  id: string;
  source: string;
};
```

Use EdgeOne KV hash helpers:

```ts
await readEdgeOneKvHashField(store, `${userId}:pr`, createPlaybackProgressField(source, id), { namespace: "user" });
await patchEdgeOneKvHash(store, `${userId}:pr`, { [createPlaybackProgressField(source, id)]: JSON.stringify(record) }, { namespace: "user" });
```

Use key `user:${userId}:pr`, field `createPlaybackProgressField(source, id)`, and metadata construction matching the spec.

- [ ] **Step 5: Implement progress API route**

Create `src/app/api/playback/progress/[source]/[id]/route.ts` with `POST`, `auth()`, JSON parsing, and `savePlaybackProgress({ source, id, ...body }, { userId })`. Return `201` with `{ progress }`.

- [ ] **Step 6: Run tests to verify GREEN**

Run:

```bash
rtk bun run test -- tests/modules/playback/playback-progress-service.test.ts tests/modules/playback/playback-progress-route.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
rtk git add src/modules/playback/server/playback-progress-service.ts src/app/api/playback/progress tests/modules/playback/playback-progress-service.test.ts tests/modules/playback/playback-progress-route.test.ts
rtk git commit -m "feat: add playback progress API"
```

## Task 4: `/play` Server Initialization and Resume

**Files:**
- Modify: `src/modules/playback/domain/playback-page-data.ts`
- Modify: `src/modules/playback/server/playback-service.ts`
- Modify: `src/app/play/page.tsx`
- Test: `tests/modules/playback/playback-service.test.ts`
- Test: `src/app/play/page.test.tsx`

- [ ] **Step 1: Write failing playback service tests**

Add a test that calls:

```ts
const result = await getPlaybackPageData(
  { id: "80474", source: "dyttzyapi.com" },
  {
    progressStore,
    userId: "user-1",
    now: () => 1768535315661,
    cacheStore: createCacheStore(),
    detailFetcher,
    videoSourceStore: createStore({ "dyttzyapi.com": createSource() }),
  },
);
```

Expect `progressStore` hash `user:user-1:pr` field `dyttzyapi.com:80474` to contain `index: 1`, `play_time: 0`, `total_time: 0`.

Add a test where the progress store already contains `index: 2`, `play_time: 125`, and expect `result.data.currentEpisode === 2`, `result.data.resumeTimeSeconds === 125`, and no overwrite.

- [ ] **Step 2: Write failing page auth test**

Mock `auth()` in `src/app/play/page.test.tsx` and expect `getPlaybackPageData` to receive a user id when source/id are present. Also expect unauthenticated page rendering to show the existing placeholder error or app-level unauthorized behavior chosen by existing auth conventions.

- [ ] **Step 3: Run tests to verify RED**

Run:

```bash
rtk bun run test -- tests/modules/playback/playback-service.test.ts src/app/play/page.test.tsx
```

Expected: FAIL because playback service does not accept progress options and page does not pass auth.

- [ ] **Step 4: Implement server initialization**

Add to `PlayPageData`:

```ts
progressSource: string;
progressId: string;
```

Add `userId?: string`, `progressStore?: PlaybackProgressStore`, and `now?: () => number` to `PlaybackPageOptions`.

After detail is loaded and before returning data:

```ts
const progress = options.userId
  ? await getOrCreateInitialPlaybackProgress(
      { source: sourceKey, id, detail: resource },
      { store: progressStore, userId: options.userId, now: options.now },
    )
  : null;
```

Return `currentEpisode` from `progress?.index ?? 1`, `resumeTimeSeconds` from `progress?.play_time`, and include `progressSource/sourceKey` plus `progressId/id`.

- [ ] **Step 5: Update page auth wiring**

In `src/app/play/page.tsx`, call `auth()` and pass `userId` to `getPlaybackPageData`. If no user id, render a placeholder error matching app convention:

```ts
return <PlayPageShell playbackPlaceholderError="请先登录后再播放。" />;
```

- [ ] **Step 6: Run tests to verify GREEN**

Run:

```bash
rtk bun run test -- tests/modules/playback/playback-service.test.ts src/app/play/page.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
rtk git add src/modules/playback/domain/playback-page-data.ts src/modules/playback/server/playback-service.ts src/app/play/page.tsx tests/modules/playback/playback-service.test.ts src/app/play/page.test.tsx
rtk git commit -m "feat: initialize playback progress on play page"
```

## Task 5: `/play` Client Progress Uploads

**Files:**
- Modify: `src/modules/playback/ui/play-page-shell.tsx`
- Test: `src/modules/playback/ui/play-page-shell.test.tsx`

- [ ] **Step 1: Write failing client upload tests**

Mock `fetch` and emit player events:

```ts
art.currentTime = 1061;
art.duration = 1247;
await act(async () => {
  art.emit("video:pause");
});
expect(fetchMock).toHaveBeenCalledWith(
  "/api/playback/progress/dyttzyapi.com/80474",
  expect.objectContaining({
    body: JSON.stringify({ index: 1, play_time: 1061, total_time: 1247 }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  }),
);
```

Add a test that interval upload happens while playing by using fake timers and advancing 20 seconds.

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
rtk bun run test -- src/modules/playback/ui/play-page-shell.test.tsx
```

Expected: FAIL because no upload logic exists.

- [ ] **Step 3: Implement upload helper and event hooks**

Add a memoized route:

```ts
const progressEndpoint = playbackData.progressSource && playbackData.progressId
  ? `/api/playback/progress/${encodeURIComponent(playbackData.progressSource)}/${encodeURIComponent(playbackData.progressId)}`
  : "";
```

Add `uploadPlaybackProgress`:

```ts
const uploadPlaybackProgress = useCallback(() => {
  const art = artPlayerRef.current;
  if (!progressEndpoint || hasPlaybackPlaceholderError || !art) return;
  void fetch(progressEndpoint, {
    body: JSON.stringify({
      index: activeEpisode,
      play_time: Math.floor(Math.max(0, art.currentTime || currentPlaybackSeconds)),
      total_time: Math.floor(Math.max(0, art.duration || currentPlaybackDuration)),
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  }).catch(() => undefined);
}, [activeEpisode, currentPlaybackDuration, currentPlaybackSeconds, hasPlaybackPlaceholderError, progressEndpoint]);
```

Call it on `video:pause`, `video:seeked`, `video:ended`, before episode reset, and from a `setInterval` effect when `isPlaying` is true. Add `pagehide`/`visibilitychange` listeners that call the same helper.

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```bash
rtk bun run test -- src/modules/playback/ui/play-page-shell.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/modules/playback/ui/play-page-shell.tsx src/modules/playback/ui/play-page-shell.test.tsx
rtk git commit -m "feat: upload playback progress from player"
```

## Task 6: Verification

**Files:**
- Read/verify all touched files.

- [ ] **Step 1: Run focused feature tests**

Run:

```bash
rtk bun run test -- tests/modules/favorites/favorite-service.test.ts tests/modules/favorites/favorite-route.test.ts src/modules/favorites/ui/favorites-page-shell.test.tsx src/modules/search/ui/search-page-shell.test.tsx tests/modules/playback/playback-progress-service.test.ts tests/modules/playback/playback-progress-route.test.ts tests/modules/playback/playback-service.test.ts src/app/play/page.test.tsx src/modules/playback/ui/play-page-shell.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run full tests**

Run:

```bash
rtk bun run test
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
rtk bun run lint
```

Expected: PASS.

- [ ] **Step 4: Run production build**

Run:

```bash
rtk bun run build
```

Expected: PASS.

- [ ] **Step 5: Final commit if verification required changes**

If verification fixes were needed:

```bash
rtk git add <changed-files>
rtk git commit -m "fix: stabilize playback progress integration"
```

If no fixes were needed, do not create an empty commit.

## Self-Review

- Spec coverage: favorites storage, no `favoriteKey`, route-param favorites, playback progress storage, zero-progress initialization, HTTP upload strategy, and auth-only access are each covered by tasks.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation steps remain.
- Type consistency: favorite record fields use snake_case consistently; playback progress uses snake_case storage and adds `source/id` only to public responses; route params are `source` and `id` throughout.
