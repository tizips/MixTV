# Cache KV Cleanup Design

## Goal

Add a scheduled API endpoint that cleans expired records from the EdgeOne `cache` KV binding.

## Scope

- Add `GET /api/cron/cache-cleanup`.
- Keep the cron route shape consistent with existing `/api/cron/*` endpoints: respond immediately and run work in `after()`.
- Clean all MixTV records stored in the `cache` KV binding, including logical namespaces such as empty cache records, `cache:*`, and `stats:*`.
- Delete only records written by the EdgeOne KV DB adapter wrapper format when their `expiresAt` value is at or before the cleanup time.
- Leave unexpired, non-expiring, malformed, and non-MixTV records untouched.

## Architecture

The route stays in `src/app/api/cron/cache-cleanup/route.ts` and delegates durable behavior to an admin server service. The service uses `createDbAdapter({ namespace: "" })` so it resolves to the EdgeOne `cache` binding without tying the service directly to a concrete KV binding. Expiration cleanup is expressed as a `DbPort.script` operation, preserving the existing DB boundary rule that storage behavior beyond `get`/`set`/`del` belongs in scripts.

The EdgeOne KV adapter recognizes the cleanup script shape and scans encoded MixTV keys in pages. It parses each adapter envelope, checks `expiresAt`, deletes expired records by encoded KV key, and returns a small summary.

## API Contract

`GET /api/cron/cache-cleanup`

Response:

```json
{ "message": "Cache cleanup scheduled." }
```

Background failures are logged and do not change the immediate response, matching the existing cron endpoints.

## Cleanup Result

The internal service returns:

```ts
{
  deleted: number;
  scanned: number;
  completedAt: string;
}
```

## Testing

- Unit-test the admin cache cleanup service to ensure it invokes the cleanup script against the cache binding with a deterministic timestamp.
- Extend EdgeOne KV adapter tests to verify expired wrapped records are deleted while unexpired and non-expiring records remain.
- Add a cron route test that verifies the endpoint schedules the cleanup in `after()`.
