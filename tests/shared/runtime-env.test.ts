import { afterEach, describe, expect, it, vi } from "vitest";
import type { EdgeOneKvBinding } from "@/infrastructure/db/edgeone-kv-db-adapter";
import { getRuntimeEnv, resetRuntimeEnvCacheForTest } from "@/shared/runtime-env";

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

describe("runtime env", () => {
  afterEach(() => {
    delete (globalThis as typeof globalThis & { env?: EdgeOneKvBinding }).env;
    resetRuntimeEnvCacheForTest();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("reads runtime variables from the EdgeOne KV binding named env", async () => {
    vi.stubEnv("AUTH_SECRET", "process-secret");
    vi.stubEnv("USERNAME", "process-admin");
    (globalThis as typeof globalThis & { env?: EdgeOneKvBinding }).env = new FakeEnvKvBinding({
      AUTH_SECRET: "kv-secret",
      PASSWORD: "kv-password",
      USERNAME: "kv-admin",
    });

    await expect(getRuntimeEnv(["AUTH_SECRET", "USERNAME", "PASSWORD"])).resolves.toMatchObject({
      AUTH_SECRET: "kv-secret",
      PASSWORD: "kv-password",
      USERNAME: "kv-admin",
    });
  });

  it("maps remote KV aliases to the requested runtime env names", async () => {
    (globalThis as typeof globalThis & { env?: EdgeOneKvBinding }).env = new FakeEnvKvBinding({
      auth_secret: "kv-secret",
      password: "kv-password",
      site_name: "MixTV",
      username: "kv-admin",
    });

    await expect(getRuntimeEnv([
      "AUTH_SECRET",
      "NEXT_PUBLIC_SITE_NAME",
      "PASSWORD",
      "USERNAME",
    ])).resolves.toEqual({
      AUTH_SECRET: "kv-secret",
      NEXT_PUBLIC_SITE_NAME: "MixTV",
      PASSWORD: "kv-password",
      USERNAME: "kv-admin",
    });
  });

  it("prefers an exact KV key over its lowercase alias", async () => {
    (globalThis as typeof globalThis & { env?: EdgeOneKvBinding }).env = new FakeEnvKvBinding({
      AUTH_SECRET: "exact-secret",
      auth_secret: "alias-secret",
    });

    await expect(getRuntimeEnv(["AUTH_SECRET"])).resolves.toEqual({
      AUTH_SECRET: "exact-secret",
    });
  });

  it("does not fall back to platform env when the env KV binding is missing a key", async () => {
    vi.stubEnv("AUTH_SECRET", "process-secret");
    (globalThis as typeof globalThis & { env?: EdgeOneKvBinding }).env = new FakeEnvKvBinding({});

    await expect(getRuntimeEnv(["AUTH_SECRET"])).resolves.toEqual({
      AUTH_SECRET: undefined,
    });
  });

  it("returns undefined values when the env KV binding is unavailable", async () => {
    vi.stubEnv("AUTH_SECRET", "process-secret");

    await expect(getRuntimeEnv(["AUTH_SECRET", "USERNAME"])).resolves.toEqual({
      AUTH_SECRET: undefined,
      USERNAME: undefined,
    });
  });
});
