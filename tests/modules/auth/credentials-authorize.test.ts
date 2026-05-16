import { describe, expect, it, vi } from "vitest";
import { authorizeCredentials } from "@/modules/auth/server/credentials-authorize";

describe("authorizeCredentials", () => {
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
