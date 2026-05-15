# Playback Progress and Favorite Records Design

## Summary

MixTV will store playback progress and favorites as user-scoped Redis hashes. Both features identify a media resource with the same field format, `{sourceKey}:{sourceId}`, but they store different value shapes:

- Playback progress stores resume state and resource metadata.
- Favorites store only favorite resource metadata, with no playback progress fields.

All routes require an authenticated user. Unauthenticated requests return `401`.

## Goals

- Save and resume playback progress for `/play`.
- Create a zero-progress record as soon as a logged-in user opens `/play?source=...&id=...` and the user has no existing progress for that media resource.
- Keep progress storage compact and compatible with the existing `DbPort.script` Redis rule.
- Align favorites with the new snake_case resource metadata shape.
- Remove `favoriteKey` from stored values and API responses.

## Non-Goals

- WebSocket-based progress updates.
- Anonymous playback progress or anonymous favorites.
- Migrating old stored favorite records in Redis.
- Adding cross-device conflict resolution beyond last-write-wins by `save_time`.

## Data Model

### Resource Identity

The resource identity is the pair:

- `source`: the video source key, such as `bfzy`.
- `id`: the third-party source media id.

The Redis hash field is:

```text
{source}:{id}
```

The field is derived by the server from route params or page query params after trimming and validating both values.

### Playback Progress

Redis key:

```text
user:{userId}:pr
```

Redis type: hash.

Value JSON:

```json
{
  "title": "神墓年番",
  "source_name": "暴风资源",
  "year": "2025",
  "cover": "https://img.picbf.com/upload/vod/20250808-1/ed0a6fa49ac90744f08f74514a9ac4b2.jpg",
  "index": 25,
  "total_episodes": 25,
  "original_episodes": 25,
  "play_time": 1061,
  "total_time": 1247,
  "save_time": 1768535315661,
  "search_title": "",
  "remarks": "更新至第25集",
  "douban_id": 36597288
}
```

Rules:

- `index` is the currently watched episode number. It is clamped to `1..total_episodes` when total episodes are known.
- `play_time` is the current playback time in seconds. It must be a finite non-negative number.
- `total_time` is the current episode duration in seconds. It must be a finite non-negative number.
- `save_time` is generated server-side as a Unix timestamp in milliseconds.
- `search_title` defaults to an empty string when the source detail does not provide it.
- `douban_id` defaults to `0` when unavailable.
- `total_episodes` and `original_episodes` are derived from the third-party detail episode count.

### Favorites

Redis key:

```text
user:{userId}:fav
```

Redis type: hash.

Value JSON:

```json
{
  "title": "神墓年番",
  "source_name": "暴风资源",
  "year": "2025",
  "cover": "https://img.picbf.com/upload/vod/20250808-1/ed0a6fa49ac90744f08f74514a9ac4b2.jpg",
  "total_episodes": 25,
  "original_episodes": 25,
  "save_time": 1768535315661,
  "search_title": "",
  "remarks": "更新至第25集",
  "douban_id": 36597288
}
```

Favorites must not store:

- `favoriteKey`
- `index`
- `play_time`
- `total_time`

API responses for favorites also omit `favoriteKey`. UI actions use the explicit `source` and `id` values. The public favorite item therefore includes `source` and `id` as response fields derived from the hash field, not stored inside the Redis value.

## API Design

### Playback Progress Update

Route:

```text
POST /api/playback/progress/[source]/[id]
```

Request body:

```json
{
  "index": 25,
  "play_time": 1061,
  "total_time": 1247
}
```

Behavior:

- Authenticate with `auth()`.
- Validate route params and JSON body.
- Load the enabled video source and third-party media detail.
- Merge detail metadata with the requested progress fields.
- Store the record in `user:{userId}:pr`, hash field `{source}:{id}`.
- Return `201` when the record is created or updated successfully.

Response:

```json
{
  "progress": {
    "source": "bfzy",
    "id": "123",
    "title": "神墓年番",
    "source_name": "暴风资源",
    "year": "2025",
    "cover": "https://img.picbf.com/upload/vod/20250808-1/ed0a6fa49ac90744f08f74514a9ac4b2.jpg",
    "index": 25,
    "total_episodes": 25,
    "original_episodes": 25,
    "play_time": 1061,
    "total_time": 1247,
    "save_time": 1768535315661,
    "search_title": "",
    "remarks": "更新至第25集",
    "douban_id": 36597288
  }
}
```

Expected failures:

- `401` with `{ "message": "Unauthorized." }` for missing login.
- `400` with `{ "message": string }` for invalid route params, invalid JSON, or invalid progress fields.
- `400` with `{ "message": "source not found." }` when the source is not enabled or not found.
- `500` with a stable fallback message for unexpected failures.

### Favorites

Create route:

```text
POST /api/favorites/[source]/[id]
```

Delete route:

```text
DELETE /api/favorites/[source]/[id]
```

List route remains:

```text
GET /api/favorites
```

Create behavior:

- Authenticate with `auth()`.
- Validate route params.
- Load enabled video source and third-party media detail.
- Store favorite metadata in `user:{userId}:fav`, hash field `{source}:{id}`.
- Return `201` with `{ "favorite": FavoriteItem }`.

Delete behavior:

- Authenticate with `auth()`.
- Validate route params.
- Delete the field from `user:{userId}:fav`.
- Return the normalized remaining collection as `{ "favorites": FavoriteItem[] }`.

Favorite response item:

```json
{
  "source": "bfzy",
  "id": "123",
  "title": "神墓年番",
  "source_name": "暴风资源",
  "year": "2025",
  "cover": "https://img.picbf.com/upload/vod/20250808-1/ed0a6fa49ac90744f08f74514a9ac4b2.jpg",
  "total_episodes": 25,
  "original_episodes": 25,
  "save_time": 1768535315661,
  "search_title": "",
  "remarks": "更新至第25集",
  "douban_id": 36597288
}
```

## `/play` Integration

`getPlaybackPageData` will receive the authenticated `userId` from the page.

When `/play?source=...&id=...` is opened:

1. Validate `source` and `id`.
2. Load enabled source and third-party detail as it does today.
3. Read `user:{userId}:pr` field `{source}:{id}`.
4. If the field is missing, write a zero-progress record immediately:
   - `index = 1`
   - `play_time = 0`
   - `total_time = 0`
   - `save_time = now`
5. Use the existing record, or the newly created zero record, to set:
   - `currentEpisode`
   - `resumeTimeSeconds`

If playback detail loading fails, no progress record is created because the server cannot safely derive required metadata.

## Client Upload Strategy

The `/play` client shell will use HTTP, not WebSocket.

Upload triggers:

- Periodic upload while playing, roughly every 20 seconds.
- `pause`
- `seeked`
- `ended`
- episode changes
- page visibility/pagehide when possible

Failures do not block playback. The UI keeps playing and can retry on the next trigger. The request body only sends playback state; metadata is trusted from the server-side detail fetch.

## Module Boundaries

- `src/app/*` route handlers and pages handle routing, auth, response shape, and page orchestration.
- `src/modules/playback/server/*` owns playback progress validation, record construction, and Redis scripts.
- `src/modules/favorites/server/favorite-service.ts` owns favorite metadata validation, record construction, and Redis scripts.
- Redis hash operations use `DbPort.script`; no new DB adapter methods are introduced.

## Testing

Use TDD for implementation.

Playback tests:

- Progress service creates a zero record for a user-scoped media field.
- Progress service updates `index/play_time/total_time` and generates `save_time`.
- Progress service rejects invalid body values.
- API route requires auth and validates route params/body.
- `/play` initializes a missing progress record and resumes from an existing record.

Favorites tests:

- Favorite service stores the snake_case metadata format.
- Favorite service response includes `source` and `id`, but no `favoriteKey`.
- Favorite service does not store or return playback progress fields.
- Favorite delete uses route params.
- Favorite UI creates play links from `source` and `id` and deletes via route params.

Regression tests:

- Existing playback page rendering remains intact.
- Existing search and auth tests should remain unaffected.
