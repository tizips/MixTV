# MixTV Foundation Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the initial modular-monolith foundation for MixTV with enforceable boundaries, shared kernel contracts, auth interfaces, and storage/cache abstractions.

**Architecture:** Start from the minimum viable skeleton that locks directory boundaries and stable APIs first, then layer adapters and module entrypoints. All business code lives under `src/modules/*`; `src/app/*` remains orchestration-only. Shared contracts (`errors`, `auth`, `storage`, `cache`, `events`) are defined before feature implementations to keep module coupling low.

**Tech Stack:** Next.js (App Router), React 19, TypeScript, Vitest, Zod, TanStack Query, TailwindCSS.

---

## Scope Split Note

The source spec covers many independent subsystems (`watch-room`, `ai-recommend`, `tvbox`, `download`, etc.). This plan intentionally covers only **Phase 1 Foundation** to keep one plan independently deliverable. Follow-up plans should be created per subsystem family after this foundation lands.

## File Structure Map (Phase 1)

- Create: `src/app/layout.tsx` — app shell and global providers mount point.
- Create: `src/app/page.tsx` — minimal orchestrator page.
- Create: `src/shared/errors/app-error.ts` — unified error model and helpers.
- Create: `src/shared/storage/storage-port.ts` — storage capability contract.
- Create: `src/shared/cache/cache-port.ts` — cache capability contract.
- Create: `src/shared/auth/auth-types.ts` — session/permission types.
- Create: `src/shared/events/domain-event.ts` — typed event contract.
- Create: `src/modules/auth/index.ts` — stable auth public API.
- Create: `src/modules/auth/application/auth-service.ts` — auth use-case orchestration interface.
- Create: `src/modules/auth/domain/permissions.ts` — permission check utilities.
- Create: `src/modules/search/index.ts` — search module public API placeholder.
- Create: `src/modules/playback/index.ts` — playback module public API placeholder.
- Create: `src/integrations/tmdb/tmdb-adapter.ts` — adapter interface + normalization example.
- Create: `src/infrastructure/storage/memory-storage-adapter.ts` — local storage adapter for dev/test.
- Create: `src/infrastructure/cache/memory-cache-adapter.ts` — local cache adapter for dev/test.
- Create: `tests/shared/errors/app-error.test.ts` — error model tests.
- Create: `tests/shared/storage/storage-port-contract.test.ts` — storage contract tests.
- Create: `tests/modules/auth/permissions.test.ts` — permission behavior tests.

### Task 1: Scaffold Modular Monolith Directories

**Files:**
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/modules/auth/domain/.gitkeep`
- Create: `src/modules/auth/application/.gitkeep`
- Create: `src/modules/auth/infrastructure/.gitkeep`
- Create: `src/modules/auth/server/.gitkeep`
- Create: `src/modules/auth/ui/.gitkeep`
- Create: `src/modules/search/domain/.gitkeep`
- Create: `src/modules/search/application/.gitkeep`
- Create: `src/modules/search/infrastructure/.gitkeep`
- Create: `src/modules/search/server/.gitkeep`
- Create: `src/modules/search/ui/.gitkeep`
- Create: `src/modules/playback/domain/.gitkeep`
- Create: `src/modules/playback/application/.gitkeep`
- Create: `src/modules/playback/infrastructure/.gitkeep`
- Create: `src/modules/playback/server/.gitkeep`
- Create: `src/modules/playback/ui/.gitkeep`
- Create: `src/integrations/tmdb/.gitkeep`
- Create: `src/shared/errors/.gitkeep`
- Create: `src/shared/storage/.gitkeep`
- Create: `src/shared/cache/.gitkeep`
- Create: `src/shared/auth/.gitkeep`
- Create: `src/shared/events/.gitkeep`
- Create: `src/infrastructure/storage/.gitkeep`
- Create: `src/infrastructure/cache/.gitkeep`

- [ ] **Step 1: Write failing structure test**

```ts
// tests/architecture/folder-layout.test.ts
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

const requiredPaths = [
  "src/app",
  "src/modules/auth/domain",
  "src/modules/auth/application",
  "src/modules/auth/infrastructure",
  "src/modules/auth/server",
  "src/modules/auth/ui",
  "src/shared/errors",
  "src/shared/storage",
  "src/shared/cache",
  "src/integrations/tmdb",
  "src/infrastructure/storage",
  "src/infrastructure/cache",
];

describe("folder layout", () => {
  it("matches modular-monolith base structure", () => {
    for (const p of requiredPaths) {
      expect(existsSync(p)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/architecture/folder-layout.test.ts`
Expected: FAIL with missing folder assertions.

- [ ] **Step 3: Create minimal folder/file structure**

```tsx
// src/app/layout.tsx
import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

```tsx
// src/app/page.tsx
export default function HomePage() {
  return <main>MixTV</main>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/architecture/folder-layout.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app src/modules src/shared src/integrations src/infrastructure tests/architecture/folder-layout.test.ts
git commit -m "chore: scaffold phase1 modular monolith folders"
```

### Task 2: Add Shared Error and Port Contracts

**Files:**
- Create: `src/shared/errors/app-error.ts`
- Create: `src/shared/storage/storage-port.ts`
- Create: `src/shared/cache/cache-port.ts`
- Create: `tests/shared/errors/app-error.test.ts`
- Create: `tests/shared/storage/storage-port-contract.test.ts`

- [ ] **Step 1: Write failing tests for error and storage contracts**

```ts
// tests/shared/errors/app-error.test.ts
import { describe, expect, it } from "vitest";
import { AppError, createAppError } from "@/shared/errors/app-error";

describe("AppError", () => {
  it("preserves code and retryability", () => {
    const err = createAppError({
      code: "AUTH_REQUIRED",
      message: "login required",
      retryable: false,
      userVisible: true,
      reportable: false,
      level: "warn",
    });
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe("AUTH_REQUIRED");
    expect(err.retryable).toBe(false);
  });
});
```

```ts
// tests/shared/storage/storage-port-contract.test.ts
import { describe, expect, it } from "vitest";
import type { StoragePort } from "@/shared/storage/storage-port";

describe("StoragePort contract", () => {
  it("requires get/set/remove methods", () => {
    type Keys = keyof StoragePort;
    const keys: Keys[] = ["get", "set", "remove"];
    expect(keys).toEqual(["get", "set", "remove"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest tests/shared/errors/app-error.test.ts tests/shared/storage/storage-port-contract.test.ts`
Expected: FAIL with module-not-found errors.

- [ ] **Step 3: Implement minimal shared contracts**

```ts
// src/shared/errors/app-error.ts
export type ErrorLevel = "info" | "warn" | "error";

export type AppErrorInput = {
  code: string;
  message: string;
  retryable: boolean;
  userVisible: boolean;
  reportable: boolean;
  level: ErrorLevel;
};

export class AppError extends Error {
  code: string;
  retryable: boolean;
  userVisible: boolean;
  reportable: boolean;
  level: ErrorLevel;

  constructor(input: AppErrorInput) {
    super(input.message);
    this.name = "AppError";
    this.code = input.code;
    this.retryable = input.retryable;
    this.userVisible = input.userVisible;
    this.reportable = input.reportable;
    this.level = input.level;
  }
}

export const createAppError = (input: AppErrorInput): AppError => new AppError(input);
```

```ts
// src/shared/storage/storage-port.ts
export interface StoragePort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  remove(key: string): Promise<void>;
}
```

```ts
// src/shared/cache/cache-port.ts
export interface CachePort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  invalidate(key: string): Promise<void>;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest tests/shared/errors/app-error.test.ts tests/shared/storage/storage-port-contract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/errors/app-error.ts src/shared/storage/storage-port.ts src/shared/cache/cache-port.ts tests/shared/errors/app-error.test.ts tests/shared/storage/storage-port-contract.test.ts
git commit -m "feat: define shared error and storage/cache contracts"
```

### Task 3: Add Auth Public API and Permission Rules

**Files:**
- Create: `src/shared/auth/auth-types.ts`
- Create: `src/modules/auth/domain/permissions.ts`
- Create: `src/modules/auth/application/auth-service.ts`
- Create: `src/modules/auth/index.ts`
- Create: `tests/modules/auth/permissions.test.ts`

- [ ] **Step 1: Write failing permission tests**

```ts
// tests/modules/auth/permissions.test.ts
import { describe, expect, it } from "vitest";
import { hasPermission } from "@/modules/auth";

describe("hasPermission", () => {
  it("returns true when permission exists", () => {
    const result = hasPermission(["admin:read", "admin:write"], "admin:write");
    expect(result).toBe(true);
  });

  it("returns false when permission is missing", () => {
    const result = hasPermission(["content:read"], "admin:write");
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/modules/auth/permissions.test.ts`
Expected: FAIL with missing module `@/modules/auth`.

- [ ] **Step 3: Implement minimal auth surface**

```ts
// src/shared/auth/auth-types.ts
export type Permission = string;

export type Session = {
  userId: string;
  permissions: Permission[];
};
```

```ts
// src/modules/auth/domain/permissions.ts
import type { Permission } from "@/shared/auth/auth-types";

export const hasPermission = (permissions: Permission[], expected: Permission): boolean =>
  permissions.includes(expected);
```

```ts
// src/modules/auth/application/auth-service.ts
import type { Session } from "@/shared/auth/auth-types";

export interface AuthService {
  getSession(): Promise<Session | null>;
  login(username: string, password: string): Promise<Session>;
  logout(): Promise<void>;
}
```

```ts
// src/modules/auth/index.ts
export { hasPermission } from "./domain/permissions";
export type { AuthService } from "./application/auth-service";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/modules/auth/permissions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/auth/auth-types.ts src/modules/auth/domain/permissions.ts src/modules/auth/application/auth-service.ts src/modules/auth/index.ts tests/modules/auth/permissions.test.ts
git commit -m "feat: establish auth public api and permission rule"
```

### Task 4: Add Local Adapters and Integration Normalization Example

**Files:**
- Create: `src/infrastructure/storage/memory-storage-adapter.ts`
- Create: `src/infrastructure/cache/memory-cache-adapter.ts`
- Create: `src/integrations/tmdb/tmdb-adapter.ts`
- Create: `src/modules/search/index.ts`
- Create: `src/modules/playback/index.ts`
- Create: `tests/infrastructure/memory-adapters.test.ts`

- [ ] **Step 1: Write failing adapter tests**

```ts
// tests/infrastructure/memory-adapters.test.ts
import { describe, expect, it } from "vitest";
import { createMemoryStorageAdapter } from "@/infrastructure/storage/memory-storage-adapter";
import { createMemoryCacheAdapter } from "@/infrastructure/cache/memory-cache-adapter";

describe("memory adapters", () => {
  it("stores and reads storage values", async () => {
    const storage = createMemoryStorageAdapter();
    await storage.set("k1", { ok: true });
    const value = await storage.get<{ ok: boolean }>("k1");
    expect(value).toEqual({ ok: true });
  });

  it("invalidates cache values", async () => {
    const cache = createMemoryCacheAdapter();
    await cache.set("k1", 123, 60);
    await cache.invalidate("k1");
    const value = await cache.get<number>("k1");
    expect(value).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest tests/infrastructure/memory-adapters.test.ts`
Expected: FAIL with missing adapter modules.

- [ ] **Step 3: Implement minimal adapters and normalized DTO sample**

```ts
// src/infrastructure/storage/memory-storage-adapter.ts
import type { StoragePort } from "@/shared/storage/storage-port";

export const createMemoryStorageAdapter = (): StoragePort => {
  const store = new Map<string, unknown>();

  return {
    async get<T>(key: string): Promise<T | null> {
      return (store.get(key) as T | undefined) ?? null;
    },
    async set<T>(key: string, value: T): Promise<void> {
      store.set(key, value);
    },
    async remove(key: string): Promise<void> {
      store.delete(key);
    },
  };
};
```

```ts
// src/infrastructure/cache/memory-cache-adapter.ts
import type { CachePort } from "@/shared/cache/cache-port";

export const createMemoryCacheAdapter = (): CachePort => {
  const store = new Map<string, unknown>();

  return {
    async get<T>(key: string): Promise<T | null> {
      return (store.get(key) as T | undefined) ?? null;
    },
    async set<T>(key: string, value: T): Promise<void> {
      store.set(key, value);
    },
    async invalidate(key: string): Promise<void> {
      store.delete(key);
    },
  };
};
```

```ts
// src/integrations/tmdb/tmdb-adapter.ts
export type TmdbMovieDto = {
  id: number;
  title: string;
  overview: string;
};

export type NormalizedTitle = {
  source: "tmdb";
  contentId: string;
  name: string;
  summary: string;
};

export const normalizeTmdbMovie = (input: TmdbMovieDto): NormalizedTitle => ({
  source: "tmdb",
  contentId: String(input.id),
  name: input.title,
  summary: input.overview,
});
```

```ts
// src/modules/search/index.ts
export type SearchModuleApi = {
  version: "v1";
};

export const searchModuleApi: SearchModuleApi = { version: "v1" };
```

```ts
// src/modules/playback/index.ts
export type PlaybackModuleApi = {
  version: "v1";
};

export const playbackModuleApi: PlaybackModuleApi = { version: "v1" };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest tests/infrastructure/memory-adapters.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/storage/memory-storage-adapter.ts src/infrastructure/cache/memory-cache-adapter.ts src/integrations/tmdb/tmdb-adapter.ts src/modules/search/index.ts src/modules/playback/index.ts tests/infrastructure/memory-adapters.test.ts
git commit -m "feat: add local adapters and integration normalization baseline"
```

## Self-Review

- Spec coverage: This plan covers architecture base, directory responsibilities, shared contracts, auth boundary, integration normalization pattern, and test baseline for early modules.
- Gaps intentionally excluded: advanced modules (`watch-room`, `ai-recommend`, `tvbox`, `download`), API route handlers, telemetry dashboards, and full SSR/query pipelines are deferred to follow-up plans.
- Placeholder scan: No TBD/TODO placeholders remain.
- Type consistency: `StoragePort`, `CachePort`, permission types, and normalized DTO names are consistent across tasks.
