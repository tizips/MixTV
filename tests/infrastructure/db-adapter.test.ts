import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDbAdapter } from "@/infrastructure/db/db-adapter";
import { createEdgeOneKvDbAdapter, type EdgeOneKvBinding } from "@/infrastructure/db/edgeone-kv-db-adapter";
import { resetRuntimeEnvCacheForTest } from "@/shared/runtime-env";

vi.mock("@/infrastructure/db/edgeone-kv-db-adapter", () => ({
  createEdgeOneKvDbAdapter: vi.fn(() => ({
    del: vi.fn(),
    get: vi.fn(),
    script: vi.fn(),
    set: vi.fn(),
  })),
}));

class FakeEnvKvBinding implements EdgeOneKvBinding {
  constructor(private readonly values: Record<string, string>) {}

  async delete(key: string) {
    delete this.values[key];
  }

  async get(key: string) {
    return this.values[key] ?? null;
  }

  async list() {
    return {
      keys: Object.keys(this.values).map((name) => ({ name })),
      list_complete: true,
    };
  }

  async put(key: string, value: string) {
    this.values[key] = value;
  }
}

describe("db adapter factory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (globalThis as typeof globalThis & { env?: EdgeOneKvBinding }).env;
    resetRuntimeEnvCacheForTest();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("always creates the EdgeOne KV adapter without a backend switch", () => {
    const binding = {
      delete: vi.fn(),
      get: vi.fn(),
      list: vi.fn(),
      put: vi.fn(),
    };

    const adapter = createDbAdapter<{ id: string }>({
      client: binding,
      namespace: "user",
    });

    expect(adapter).toBeDefined();
    expect(createEdgeOneKvDbAdapter).toHaveBeenCalledWith({
      binding,
      bindingName: "user",
      namespace: "user",
    });
  });

  it("maps Store namespaces to cfg, cache, and user bindings", () => {
    createDbAdapter<{ id: string }>({ namespace: "admin" });
    createDbAdapter<{ id: string }>({ namespace: "stats" });
    createDbAdapter<{ id: string }>({ namespace: "cache" });
    createDbAdapter<{ id: string }>({ namespace: "" });
    createDbAdapter<{ id: string }>({ namespace: "user" });
    createDbAdapter<{ id: string }>({ namespace: "favorites" });

    expect(createEdgeOneKvDbAdapter).toHaveBeenNthCalledWith(1, expect.objectContaining({
      bindingName: "cfg",
      namespace: "admin",
    }));
    expect(createEdgeOneKvDbAdapter).toHaveBeenNthCalledWith(2, expect.objectContaining({
      bindingName: "cache",
      namespace: "stats",
    }));
    expect(createEdgeOneKvDbAdapter).toHaveBeenNthCalledWith(3, expect.objectContaining({
      bindingName: "cache",
      namespace: "cache",
    }));
    expect(createEdgeOneKvDbAdapter).toHaveBeenNthCalledWith(4, expect.objectContaining({
      bindingName: "cache",
      namespace: "",
    }));
    expect(createEdgeOneKvDbAdapter).toHaveBeenNthCalledWith(5, expect.objectContaining({
      bindingName: "user",
      namespace: "user",
    }));
    expect(createEdgeOneKvDbAdapter).toHaveBeenNthCalledWith(6, expect.objectContaining({
      bindingName: "user",
      namespace: "favorites",
    }));
  });

  it("does not need env KV config to choose the storage backend", async () => {
    (globalThis as typeof globalThis & { env?: EdgeOneKvBinding }).env = new FakeEnvKvBinding({
      AUTH_SECRET: "kv-secret",
    });

    const adapter = createDbAdapter<{ id: string }>({
      namespace: "user",
    });

    await adapter.get("user-1:pr");

    expect(createEdgeOneKvDbAdapter).toHaveBeenCalledWith(expect.objectContaining({
      binding: undefined,
      bindingName: "user",
      namespace: "user",
    }));
  });
});
