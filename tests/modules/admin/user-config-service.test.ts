import { describe, expect, it, vi } from "vitest";

const createDbAdapterMock = vi.hoisted(() =>
  vi.fn(() => ({
    del: vi.fn(async () => undefined),
    get: vi.fn(async () => null),
    script: vi.fn(async <TResult = unknown>() => ({} as TResult)),
    set: vi.fn(async () => undefined),
  })),
);

vi.mock("@/infrastructure/db/db-adapter", () => ({
  createDbAdapter: createDbAdapterMock,
}));

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

const createFakeStore = (initial: Record<string, string> = {}): UserConfigStore => {
  const hash = new Map(Object.entries(initial));

  return {
    del: vi.fn(async () => undefined),
    get: vi.fn(async () => null),
    script: vi.fn(async <TResult = unknown>(script: string, options = {}) => {
      const runOptions = options as { args?: unknown[] };

      if (script.includes("HGETALL")) {
        return Object.fromEntries(hash) as TResult;
      }

      if (script.includes("HSET")) {
        const [id, rawUser] = runOptions.args ?? [];

        if (typeof id === "string" && typeof rawUser === "string") {
          hash.set(id, rawUser);
        }

        return 1 as TResult;
      }

      if (script.includes("HDEL")) {
        const [username] = runOptions.args ?? [];

        if (typeof username === "string") {
          hash.delete(username);
        }

        return 1 as TResult;
      }

      return {} as TResult;
    }) as UserConfigStore["script"],
    set: vi.fn(async () => undefined),
  };
};

describe("user config service", () => {
  it("creates the user config store with the admin namespace", () => {
    createUserConfigStore();

    expect(createDbAdapterMock).toHaveBeenCalledWith({ namespace: "admin" });
  });

  it("returns an empty collection when the redis hash is empty", async () => {
    const store = createFakeStore();

    await expect(getUsers(store)).resolves.toEqual({
      updatedAt: null,
      users: [],
    });
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HGETALL"), {
      keys: ["users"],
      readOnly: true,
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
    const store = createFakeStore({ [user.username]: JSON.stringify(user) });

    await expect(getUsers(store)).resolves.toEqual({
      updatedAt: user.createdAt,
      users: [user],
    });
  });

  it("creates, updates, and deletes users through redis hash commands", async () => {
    const store = createFakeStore();
    const created = await createUser(
      {
        password: "Secret123",
        role: "user",
        status: "active",
        username: " dave ",
      },
      store,
    );

    expect(created.username).toBe("dave");
    expect(created).not.toHaveProperty("id");
    expect(store.set).not.toHaveBeenCalledWith("users", expect.anything());
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HSET"), {
      args: [created.username, expect.not.stringContaining('"id"')],
      keys: ["users"],
    });
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HSET"), {
      args: [created.username, expect.stringContaining('"passwordHash"')],
      keys: ["users"],
    });
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HSET"), {
      args: [created.username, expect.not.stringContaining('"password"')],
      keys: ["users"],
    });
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HSET"), {
      args: [created.username, expect.not.stringContaining("secret")],
      keys: ["users"],
    });

    const updated = await updateUser(created.username, [{ role: "owner" }], store);
    expect(updated.users.find((user) => user.username === created.username)?.role).toBe("owner");

    const deleted = await deleteUser(created.username, store);
    expect(deleted.users.some((user) => user.username === created.username)).toBe(false);
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HDEL"), {
      args: [created.username],
      keys: ["users"],
    });
    await expect(getUsers(store)).resolves.toEqual(deleted);
  });

  it("updates only keys supplied in user patch arrays", async () => {
    const store = createFakeStore();
    await createUser(
      {
        password: "Oldsecret1",
        role: "user",
        status: "active",
        username: "grace",
      },
      store,
    );

    const updated = await updateUser(
      "grace",
      [{ status: "banned" }, { role: "owner" }, { password: "Newsecret1" }],
      store,
    );
    const user = updated.users.find((item) => item.username === "grace");

    expect(user).toMatchObject({
      role: "owner",
      status: "banned",
      username: "grace",
    });
    await expect(verifyUserPassword("grace", "Newsecret1", store)).resolves.toBe(true);
    await expect(updateUser("grace", [{ unknown: true }], store)).rejects.toThrow("user patch key is invalid.");
  });

  it("rejects creating a user that conflicts with the env admin username", async () => {
    const originalUsername = process.env.USERNAME;
    process.env.USERNAME = "admin";

    try {
      await expect(
        createUser(
          {
            password: "Secret123",
            role: "user",
            status: "active",
            username: " admin ",
          },
          createFakeStore(),
        ),
      ).rejects.toThrow("username conflicts with the configured admin user.");
    } finally {
      process.env.USERNAME = originalUsername;
    }
  });

  it("updates a user's password without exposing it in the response", async () => {
    const store = createFakeStore();
    await createUser(
      {
        password: "Oldsecret1",
        role: "user",
        status: "active",
        username: "erin",
      },
      store,
    );

    const updated = await updateUserPassword("erin", { password: "Newsecret1" }, store);

    const updatedUser = updated.users.find((user) => user.username === "erin");

    expect(updatedUser).toBeDefined();
    expect(updatedUser).not.toHaveProperty("password");
    expect(updatedUser?.updatedAt).toEqual(expect.any(String));
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HSET"), {
      args: ["erin", expect.stringContaining('"passwordHash"')],
      keys: ["users"],
    });
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HSET"), {
      args: ["erin", expect.not.stringContaining('"password"')],
      keys: ["users"],
    });
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HSET"), {
      args: ["erin", expect.not.stringContaining("Newsecret1")],
      keys: ["users"],
    });
  });

  it("verifies stored password hashes without requiring plaintext storage", async () => {
    const store = createFakeStore();
    await createUser(
      {
        password: "Correct1",
        role: "user",
        status: "active",
        username: "frank",
      },
      store,
    );

    await expect(verifyUserPassword("frank", "Correct1", store)).resolves.toBe(true);
    await expect(verifyUserPassword("frank", "Wrong1", store)).resolves.toBe(false);
  });

  it("rejects usernames and passwords outside the credential format rules", async () => {
    const store = createFakeStore();

    await expect(
      createUser(
        {
          password: "Secret123",
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
    ).rejects.toThrow("密码需为 6-20 位大小写字母或数字。");
  });
});
