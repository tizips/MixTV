# EdgeOne Pages Deployment

MixTV should be deployed to Tencent EdgeOne Pages as a Next.js full-stack application, not as a static export.

## Build Settings

The repository includes [edgeone.json](/Users/orange/Developer/Project/nextjs/MixTV/edgeone.json) so EdgeOne Pages can pick up stable project settings from source control:

- Install command: `bun install --frozen-lockfile`
- Build command: `bun run build`
- Output directory: `.next`
- Node.js version: `22.11.0`

EdgeOne Pages supports Next.js 16 full-stack output, including App Router, route handlers, SSR, ISR, middleware/proxy, response streaming, and image optimization. This app uses login, API routes, playback state, admin routes, and storage-backed mutations, so `next.config.ts` must not switch to `output: "export"`.

## Runtime Notes

- Keep [src/proxy.ts](/Users/orange/Developer/Project/nextjs/MixTV/src/proxy.ts) in the Next.js 16 `proxy.ts` format. EdgeOne Pages supports this middleware/proxy entrypoint.
- Keep [next.config.ts](/Users/orange/Developer/Project/nextjs/MixTV/next.config.ts) image handling compatible with remote media sources. The current `images.unoptimized = true` setting is acceptable on EdgeOne Pages and avoids depending on provider image optimization for arbitrary source domains.
- API route handlers can use the Node.js runtime. Request-gating code that runs through `proxy.ts` should remain Edge-compatible.

## Runtime Environment KV

For EdgeOne Pages, runtime server configuration should be stored in an EdgeOne KV namespace named `env` and bound to the Pages project with runtime variable name `env`.

Create raw KV records with the same key names that would normally be environment variables:

- `AUTH_SECRET`
- `USERNAME`
- `PASSWORD`
- `CRON_BASE_URL`

The application reads these values through [src/shared/runtime-env.ts](/Users/orange/Developer/Project/nextjs/MixTV/src/shared/runtime-env.ts). Runtime code reads only the `env` KV binding and does not fall back to platform environment variables. Values are cached briefly in memory to avoid repeated KV reads on hot paths.

The runtime config binding name is fixed to `env`.

`CRON_BASE_URL` should be the final deployed site origin, for example `https://mixtv.example.com`, so the scheduled GitHub Actions workflows can call the live `/api/cron/*` endpoints. If the workflow reads from repository or Actions secrets instead of the deployed runtime, keep `CRON_BASE_URL` configured there as well.

Auth.js still reads its `secret` option synchronously from [src/auth.ts](/Users/orange/Developer/Project/nextjs/MixTV/src/auth.ts) during module initialization, so direct Auth.js initialization cannot be completely KV-backed. The app's login/account services and [src/proxy.ts](/Users/orange/Developer/Project/nextjs/MixTV/src/proxy.ts) read `AUTH_SECRET` from the `env` KV binding. If direct proxy token validation cannot use the same synchronous Auth.js state, the proxy falls back to `/api/auth/proxy-session` for session validation.

## EdgeOne KV Storage

The project uses EdgeOne KV as the storage backend for module persistence. It stores logical records in EdgeOne KV using encoded keys that only contain letters, numbers, and underscores, matching EdgeOne's KV key restrictions.

Required Store deployment:

1. Create three EdgeOne Pages Store KV namespaces.
2. Bind them to the Pages project with runtime variable names `cfg`, `cache`, and `user`.

This backend is intended for small Store records such as playback progress, favorites, viewing history, search history, small admin configuration records, and cache/stat records. Module store factories resolve the concrete binding they own with `getEdgeOneKvBinding`: admin configuration records use `cfg`, cache/stat records use `cache`, and user-facing data uses `user`. Module services then call the EdgeOne KV helper functions directly for JSON, hash, string, list, counter, delete, logical-key listing, and cleanup operations.

EdgeOne KV is eventually consistent: the same edge node can read its own writes immediately, while other edge nodes may observe stale values for up to about 60 seconds. That is acceptable for playback progress, favorites, and history in this first version.

Existing external data is not migrated automatically. This branch starts writing new Store data to the bound KV namespaces; old playback progress, favorites, and history can be migrated later with a dedicated one-off script if needed.

## Verification

Before publishing a deployment branch, run:

```bash
bun run test
bun run lint
bun run build
```
