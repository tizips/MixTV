import { afterEach, describe, expect, it } from "vitest";
import { readEdgeOneKvHash, type EdgeOneKvBinding, writeEdgeOneKvHash } from "@/infrastructure/db/edgeone-kv-db-adapter";
import { resetRuntimeEnvCacheForTest } from "@/shared/runtime-env";
import { FakeEdgeOneKvBinding } from "../../helpers/fake-edgeone-kv";

import {
  createUser,
  createUserConfigStore,
  deleteUser,
  getUsers,
  updateUser,
  updateUserPassword,
  verifyUserPassword,
  type UserConfigStore,
} from "@/modules/admin/server/user-config-service";

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

afterEach(() => {
  delete (globalThis as typeof globalThis & { env?: EdgeOneKvBinding }).env;
  delete (globalThis as typeof globalThis & { cfg?: EdgeOneKvBinding }).cfg;
  resetRuntimeEnvCacheForTest();
});

const createFakeStore = async (initial: Record<string, string> = {}): Promise<UserConfigStore> => {
  const store = new FakeEdgeOneKvBinding();

  if (Object.keys(initial).length > 0) {
    await writeEdgeOneKvHash(store, "users", initial, { namespace: "admin" });
  }

  return store;
};

describe("user config service", () => {
  it("creates the user config store with the admin namespace", () => {
    const binding = new FakeEdgeOneKvBinding();
    (globalThis as typeof globalThis & { cfg?: EdgeOneKvBinding }).cfg = binding;

    expect(createUserConfigStore()).toBe(binding);
  });

  it("returns an empty collection when the redis hash is empty", async () => {
    const store = await createFakeStore();

    await expect(getUsers(store)).resolves.toEqual({
      updatedAt: null,
      users: [],
    });
  });

  it("reads users from redis hash JSON values", async () => {
    const user = {
      username: "charlie",
      role: "user",
      status: "active",
      createdAt: "2026-05-14T01:00:00.000Z",
      updatedAt: null,
    };
    const store = await createFakeStore({ [user.username]: JSON.stringify(user) });

    await expect(getUsers(store)).resolves.toEqual({
      updatedAt: user.createdAt,
      users: [user],
    });
  });

  it("creates, updates, and deletes users through redis hash commands", async () => {
    const store = await createFakeStore();
    const created = await createUser(
      {
        password: "Secret@123",
        role: "user",
        status: "active",
        username: " dave ",
      },
      store,
    );

    expect(created.username).toBe("dave");
    expect(created).not.toHaveProperty("id");
    const createdRecord = (await readEdgeOneKvHash(store, "users", { namespace: "admin" }))[created.username] ?? "";
    expect(createdRecord).not.toContain('"id"');
    expect(createdRecord).toContain('"passwordHash"');
    expect(createdRecord).not.toContain('"password"');
    expect(createdRecord).not.toContain("secret");

    const updated = await updateUser(created.username, [{ role: "owner" }], store);
    expect(updated.users.find((user) => user.username === created.username)?.role).toBe("owner");

    const deleted = await deleteUser(created.username, store);
    expect(deleted.users.some((user) => user.username === created.username)).toBe(false);
    expect((await readEdgeOneKvHash(store, "users", { namespace: "admin" }))[created.username]).toBeUndefined();
    await expect(getUsers(store)).resolves.toEqual(deleted);
  });

  it("updates only keys supplied in user patch arrays", async () => {
    const store = await createFakeStore();
    await createUser(
      {
        password: "Oldsecret#1",
        role: "user",
        status: "active",
        username: "grace",
      },
      store,
    );

    const updated = await updateUser(
      "grace",
      [{ status: "banned" }, { role: "owner" }, { password: "Newsecret#1" }],
      store,
    );
    const user = updated.users.find((item) => item.username === "grace");

    expect(user).toMatchObject({
      role: "owner",
      status: "banned",
      username: "grace",
    });
    await expect(verifyUserPassword("grace", "Newsecret#1", store)).resolves.toBe(true);
    await expect(updateUser("grace", [{ unknown: true }], store)).rejects.toThrow("user patch key is invalid.");
  });

  it("rejects creating a user that conflicts with the EdgeOne env KV admin username", async () => {
    (globalThis as typeof globalThis & { env?: EdgeOneKvBinding }).env = new FakeEnvKvBinding({
      USERNAME: "admin",
    });

    const store = await createFakeStore();

    await expect(
      createUser(
        {
          password: "Secret@123",
          role: "user",
          status: "active",
          username: " admin ",
        },
        store,
      ),
    ).rejects.toThrow("username conflicts with the configured admin user.");
  });

  it("updates a user's password without exposing it in the response", async () => {
    const store = await createFakeStore();
    await createUser(
      {
        password: "Oldsecret@1",
        role: "user",
        status: "active",
        username: "erin",
      },
      store,
    );

    const updated = await updateUserPassword("erin", { password: "Newsecret@1" }, store);

    const updatedUser = updated.users.find((user) => user.username === "erin");

    expect(updatedUser).toBeDefined();
    expect(updatedUser).not.toHaveProperty("password");
    expect(updatedUser?.updatedAt).toEqual(expect.any(String));
    const updatedRecord = (await readEdgeOneKvHash(store, "users", { namespace: "admin" })).erin ?? "";
    expect(updatedRecord).toContain('"passwordHash"');
    expect(updatedRecord).not.toContain('"password"');
    expect(updatedRecord).not.toContain("Newsecret@1");
  });

  it("verifies stored password hashes without requiring plaintext storage", async () => {
    const store = await createFakeStore();
    await createUser(
      {
        password: "Correct.1",
        role: "user",
        status: "active",
        username: "frank",
      },
      store,
    );

    await expect(verifyUserPassword("frank", "Correct.1", store)).resolves.toBe(true);
    await expect(verifyUserPassword("frank", "Wrong1", store)).resolves.toBe(false);
  });

  it("rejects usernames and passwords outside the credential format rules", async () => {
    const store = await createFakeStore();

    await expect(
      createUser(
        {
          password: "Secret@123",
          role: "user",
          status: "active",
          username: "Grace",
        },
        store,
      ),
    ).rejects.toThrow("用户名需为 4-20 位小写字母或数字。");

    await expect(
      createUser(
        {
          password: "secret-pass",
          role: "user",
          status: "active",
          username: "grace",
        },
        store,
      ),
    ).rejects.toThrow("密码需为 6-20 位大小写字母、数字或特殊字符 @ # . %。");
  });
});
