import { afterEach, describe, expect, it, vi } from "vitest";
import type { EdgeOneKvBinding } from "@/infrastructure/db/edgeone-kv-db-adapter";
import { authorizeCredentials } from "@/modules/auth/server/credentials-authorize";
import { resetRuntimeEnvCacheForTest } from "@/shared/runtime-env";

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

describe("authorizeCredentials", () => {
  afterEach(() => {
    delete (globalThis as typeof globalThis & { env?: EdgeOneKvBinding }).env;
    resetRuntimeEnvCacheForTest();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("reads credentials config from the EdgeOne env KV binding when no env is provided", async () => {
    (globalThis as typeof globalThis & { env?: EdgeOneKvBinding }).env = new FakeEnvKvBinding({
      AUTH_SECRET: "jwt-secret",
      PASSWORD: "Secret@123",
      USERNAME: "admin",
    });

    const user = await authorizeCredentials({
      password: "Secret@123",
      username: " admin ",
    });

    expect(user).toMatchObject({
      admin: true,
      id: "admin",
      name: "管理员",
    });
  });

  it("reads credentials config from lowercase remote KV env keys", async () => {
    (globalThis as typeof globalThis & { env?: EdgeOneKvBinding }).env = new FakeEnvKvBinding({
      auth_secret: "jwt-secret",
      password: "Secret@123",
      username: "admin",
    });

    const user = await authorizeCredentials({
      password: "Secret@123",
      username: "admin",
    });

    expect(user).toMatchObject({
      admin: true,
      id: "admin",
      name: "管理员",
    });
  });

  it("returns a NextAuth user by validating credentials directly against auth services", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const user = await authorizeCredentials(
      {
        password: "Secret@123",
        username: " admin ",
      },
      {
        AUTH_SECRET: "jwt-secret",
        PASSWORD: "Secret@123",
        USERNAME: "admin",
      },
    );

    expect(user).toMatchObject({
      admin: true,
      id: "admin",
      name: "管理员",
    });
    expect(user?.accessToken).toEqual(expect.any(String));
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockRestore();
  });
});
