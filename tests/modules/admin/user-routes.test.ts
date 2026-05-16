import { beforeEach, describe, expect, it, vi } from "vitest";
import * as createRoute from "@/app/api/admin/user/route";
import * as collectionRoute from "@/app/api/admin/users/route";
import * as itemRoute from "@/app/api/admin/users/[username]/route";

const createUserMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/admin/server/user-config-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/admin/server/user-config-service")>();

  return {
    ...actual,
    createUser: createUserMock,
  };
});

describe("user config API routes", () => {
  beforeEach(() => {
    createUserMock.mockReset();
  });

  it("uses the default Node.js runtime for storage-backed handlers", () => {
    expect("runtime" in createRoute ? createRoute.runtime : undefined).not.toBe("edge");
    expect("runtime" in collectionRoute ? collectionRoute.runtime : undefined).not.toBe("edge");
    expect("runtime" in itemRoute ? itemRoute.runtime : undefined).not.toBe("edge");
  });

  it("rejects invalid create user form payloads before creating users", async () => {
    createUserMock.mockResolvedValue({
      createdAt: "2026-05-14T00:00:00.000Z",
      role: "user",
      status: "active",
      updatedAt: null,
      username: "carol",
    });

    const response = await createRoute.POST(
      new Request("http://localhost/api/admin/user", {
        body: JSON.stringify({
          password: "secret",
          role: "user",
          status: "active",
          unexpected: true,
          username: "carol",
        }),
        method: "POST",
      }),
    );

    await expect(response.json()).resolves.toEqual({
      message: "请求体包含不支持的字段。",
    });
    expect(response.status).toBe(400);
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("returns create user form validation messages from the latest rules", async () => {
    const invalidUsernameResponse = await createRoute.POST(
      new Request("http://localhost/api/admin/user", {
        body: JSON.stringify({
          password: "Secret@123",
          role: "user",
          status: "active",
          username: "Carol",
        }),
        method: "POST",
      }),
    );

    await expect(invalidUsernameResponse.json()).resolves.toEqual({
      message: "用户名需为 4-20 位小写字母或数字。",
    });

    const invalidPasswordResponse = await createRoute.POST(
      new Request("http://localhost/api/admin/user", {
        body: JSON.stringify({
          password: "secret-pass",
          role: "user",
          status: "active",
          username: "carol",
        }),
        method: "POST",
      }),
    );

    await expect(invalidPasswordResponse.json()).resolves.toEqual({
      message: "密码需为 6-20 位大小写字母、数字或特殊字符 @ # . %。",
    });
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("rejects legacy array user patch payloads", async () => {
    const response = await itemRoute.PUT(
      new Request("http://localhost/api/admin/users/carol", {
        body: JSON.stringify([{ role: "owner" }]),
        method: "PUT",
      }),
      { params: Promise.resolve({ username: "carol" }) },
    );

    await expect(response.json()).resolves.toEqual({ message: "Request body must be an object." });
    expect(response.status).toBe(400);
  });

  it("validates password patch format before updating users", async () => {
    const response = await itemRoute.PUT(
      new Request("http://localhost/api/admin/users/carol", {
        body: JSON.stringify({ password: "new-secret" }),
        method: "PUT",
      }),
      { params: Promise.resolve({ username: "carol" }) },
    );

    await expect(response.json()).resolves.toEqual({
      message: "密码需为 6-20 位大小写字母、数字或特殊字符 @ # . %。",
    });
    expect(response.status).toBe(400);
  });
});
