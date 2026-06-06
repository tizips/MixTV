import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EdgeOneKvBinding } from "@/infrastructure/db/edgeone-kv-db-adapter";
import { issueLoginJwt } from "@/modules/auth/server/login-api-service";
import { resetRuntimeEnvCacheForTest } from "@/shared/runtime-env";
import * as route from "@/app/api/admin/edgeone-kv-diagnostics/route";

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
  auth: authMock,
}));

class FakeEdgeOneKvBinding implements EdgeOneKvBinding {
  readonly values = new Map<string, string>();

  constructor(values: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(values)) {
      this.values.set(key, value);
    }
  }

  async delete(key: string) {
    this.values.delete(key);
  }

  async get(key: string) {
    return this.values.get(key) ?? null;
  }

  async list(options?: { cursor?: string; limit?: number; prefix?: string }) {
    const keys = [...this.values.keys()]
      .filter((key) => !options?.prefix || key.startsWith(options.prefix))
      .map((name) => ({ name }));

    return {
      keys,
      list_complete: true,
    };
  }

  async put(key: string, value: string) {
    this.values.set(key, value);
  }
}

type EdgeOneGlobals = typeof globalThis & {
  cache?: EdgeOneKvBinding;
  cfg?: EdgeOneKvBinding;
  env?: EdgeOneKvBinding;
  user?: EdgeOneKvBinding;
};

describe("EdgeOne KV diagnostics route", () => {
  beforeEach(() => {
    const globals = globalThis as EdgeOneGlobals;

    delete globals.cache;
    delete globals.cfg;
    delete globals.env;
    delete globals.user;
    authMock.mockReset();
    resetRuntimeEnvCacheForTest();
  });

  it("rejects unauthenticated requests", async () => {
    authMock.mockResolvedValue(null);

    const response = await route.GET();

    expect(response.status).toBe(401);
  });

  it("rejects non-admin requests", async () => {
    authMock.mockResolvedValue({ user: { admin: false, id: "user-1" } });

    const response = await route.GET();

    expect(response.status).toBe(403);
  });

  it("checks env KV keys and probes the configured Store KV without exposing values", async () => {
    const globals = globalThis as EdgeOneGlobals;
    const cacheBinding = new FakeEdgeOneKvBinding();
    const cfgBinding = new FakeEdgeOneKvBinding();
    const userBinding = new FakeEdgeOneKvBinding();

    globals.env = new FakeEdgeOneKvBinding({
      AUTH_SECRET: "kv-secret",
      PASSWORD: "kv-password",
      USERNAME: "admin",
    });
    globals.cache = cacheBinding;
    globals.cfg = cfgBinding;
    globals.user = userBinding;
    authMock.mockResolvedValue({ user: { admin: true, id: "admin" } });

    const response = await route.GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.bindingNames).toEqual(["cache", "cfg", "env", "user"]);
    expect(payload.envBinding).toMatchObject({
      available: true,
      bindingName: "env",
      keys: {
        AUTH_SECRET: "set",
        PASSWORD: "set",
        USERNAME: "set",
      },
    });
    expect(payload.storeBindings).toEqual([
      expect.objectContaining({
        available: true,
        bindingName: "cfg",
        probe: {
          deleted: true,
          read: true,
          written: true,
        },
      }),
      expect.objectContaining({
        available: true,
        bindingName: "cache",
        probe: {
          deleted: true,
          read: true,
          written: true,
        },
      }),
      expect.objectContaining({
        available: true,
        bindingName: "user",
        probe: {
          deleted: true,
          read: true,
          written: true,
        },
      }),
    ]);
    expect(JSON.stringify(payload)).not.toContain("kv-secret");
    expect(JSON.stringify(payload)).not.toContain("kv-password");
    expect([...cacheBinding.values.keys()]).toHaveLength(0);
    expect([...cfgBinding.values.keys()]).toHaveLength(0);
    expect([...userBinding.values.keys()]).toHaveLength(0);
  });

  it("allows an admin bearer login jwt signed with the env KV auth secret", async () => {
    const globals = globalThis as EdgeOneGlobals;

    globals.env = new FakeEdgeOneKvBinding({
      AUTH_SECRET: "kv-secret",
      PASSWORD: "kv-password",
      USERNAME: "admin",
    });
    globals.cache = new FakeEdgeOneKvBinding();
    globals.cfg = new FakeEdgeOneKvBinding();
    globals.user = new FakeEdgeOneKvBinding();
    authMock.mockResolvedValue(null);

    const jwt = await issueLoginJwt("admin", "kv-secret");
    const response = await route.GET(
      new Request("http://localhost/api/admin/edgeone-kv-diagnostics", {
        headers: {
          authorization: `Bearer ${jwt}`,
        },
      }),
    );

    expect(response.status).toBe(200);
  });
});
