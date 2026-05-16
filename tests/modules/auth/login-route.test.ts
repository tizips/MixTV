import { beforeEach, describe, expect, it, vi } from "vitest";
import * as loginRoute from "@/app/api/login/route";

const authenticateLoginRequestMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/auth/server/login-api-service", () => ({
  authenticateLoginRequest: authenticateLoginRequestMock,
}));

describe("login API route", () => {
  beforeEach(() => {
    authenticateLoginRequestMock.mockReset();
  });

  it("uses the Node.js runtime", () => {
    expect(loginRoute.runtime).toBe("nodejs");
  });

  it("rejects unsupported login payload fields before authenticating", async () => {
    authenticateLoginRequestMock.mockResolvedValue({ jwt: "signed.jwt" });

    const response = await loginRoute.POST(
      new Request("http://localhost/api/login", {
        body: JSON.stringify({
          password: "secret-pass",
          remember: true,
          username: "admin",
        }),
        method: "POST",
      }),
    );

    await expect(response.json()).resolves.toEqual({
      message: "Request body contains unsupported fields.",
    });
    expect(response.status).toBe(400);
    expect(authenticateLoginRequestMock).not.toHaveBeenCalled();
  });

  it("rejects invalid credential formats before authenticating", async () => {
    const invalidUsernameResponse = await loginRoute.POST(
      new Request("http://localhost/api/login", {
        body: JSON.stringify({
          password: "Secret@123",
          username: "Admin",
        }),
        method: "POST",
      }),
    );

    await expect(invalidUsernameResponse.json()).resolves.toEqual({
      message: "Invalid username or password.",
    });
    expect(invalidUsernameResponse.status).toBe(400);

    const invalidPasswordResponse = await loginRoute.POST(
      new Request("http://localhost/api/login", {
        body: JSON.stringify({
          password: "secret-pass",
          username: "admin",
        }),
        method: "POST",
      }),
    );

    await expect(invalidPasswordResponse.json()).resolves.toEqual({
      message: "Invalid username or password.",
    });
    expect(invalidPasswordResponse.status).toBe(400);
    expect(authenticateLoginRequestMock).not.toHaveBeenCalled();
  });

  it("trims username and returns the authenticated login result", async () => {
    authenticateLoginRequestMock.mockResolvedValue({ jwt: "signed.jwt" });

    const response = await loginRoute.POST(
      new Request("http://localhost/api/login", {
        body: JSON.stringify({
          password: "Secret@123",
          username: " admin ",
        }),
        method: "POST",
      }),
    );

    await expect(response.json()).resolves.toEqual({ jwt: "signed.jwt" });
    expect(response.status).toBe(200);
    expect(authenticateLoginRequestMock).toHaveBeenCalledWith({
      password: "Secret@123",
      username: "admin",
    });
  });
});
