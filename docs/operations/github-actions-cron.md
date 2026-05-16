# GitHub Actions Cron Notes

This repository uses three separate workflows under [.github/workflows/](/Users/orange/Developer/Project/nextjs/MixTV/.github/workflows) to trigger the scheduled API jobs:

- `/api/cron/history`
- `/api/cron/subscription`
- `/api/cron/source-check`

Workflow files:

- [.github/workflows/cron-history.yml](/Users/orange/Developer/Project/nextjs/MixTV/.github/workflows/cron-history.yml)
- [.github/workflows/cron-subscription.yml](/Users/orange/Developer/Project/nextjs/MixTV/.github/workflows/cron-subscription.yml)
- [.github/workflows/cron-source-check.yml](/Users/orange/Developer/Project/nextjs/MixTV/.github/workflows/cron-source-check.yml)

## Known failure mode

We observed GitHub Actions failing with:

```text
curl: (56) Recv failure: Connection reset by peer
{"message":"History update check scheduled."}
Error: Process completed with exit code 56.
```

That pattern means the request usually reached the endpoint and the server returned the JSON response, but the connection was reset during the final read/close phase by the hosting edge layer.

## Current mitigation

The workflow now calls `curl` with:

- `--http1.1`
- `--connect-timeout 10`
- `--max-time 120`
- `--retry 5`
- `--retry-all-errors`
- `--retry-delay 2`

This keeps the cron job strict about real HTTP failures, but makes it resilient to transient edge-network resets.

## What to check if it comes back

- Confirm `CRON_BASE_URL` still points to the live site root, not a redirected URL.
- Check whether the platform changed its edge behavior or HTTP/2 handling.
- Re-run the endpoint manually with `curl --http1.1 --fail --silent --show-error` against the deployed `/api/cron/*` route.
