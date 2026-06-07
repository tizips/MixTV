import { beforeEach, describe, expect, it, vi } from "vitest";
import * as loginRoute from "@/app/api/login/route";

const authenticateLoginRequestMock = vi.hoisted(() => vi.fn());
const getAccountByJwtMock = vi.hoisted(() => vi.fn());
const encodeMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/auth/server/login-api-service", () => ({
  authenticateLoginRequest: authenticateLoginRequestMock,
  getAccountByJwt: getAccountByJwtMock,
}));

vi.mock("next-auth/jwt", () => ({
  encode: encodeMock,
}));

describe("login API route", () => {
  beforeEach(() => {
    authenticateLoginRequestMock.mockReset();
    getAccountByJwtMock.mockReset();
    encodeMock.mockReset();
    getAccountByJwtMock.mockResolvedValue({
      admin: true,
      id: "admin",
      name: "管理员",
    });
    encodeMock.mockResolvedValue("auth-session-token");
  });

  it("uses the Edge runtime so EdgeOne reads login request bodies through Web APIs", () => {
    expect(loginRoute.runtime).toBe("edge");
  });

  it("rejects invalid JSON before authenticating", async () => {
    authenticateLoginRequestMock.mockResolvedValue({ jwt: "signed.jwt" });

    const response = await loginRoute.POST(
      new Request("http://localhost/api/login", {
        body: "username=admin&password=Secret@123",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    );

    await expect(response.json()).resolves.toEqual({
      message: "Request body must be valid JSON.",
    });
    expect(response.status).toBe(400);
    expect(authenticateLoginRequestMock).not.toHaveBeenCalled();
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

  it("sets an Auth.js session cookie when credentials are accepted", async () => {
    authenticateLoginRequestMock.mockResolvedValue({ jwt: "signed.jwt" });

    const response = await loginRoute.POST(
      new Request("https://mixtv.example/api/login", {
        body: JSON.stringify({
          password: "Secret@123",
          username: "admin",
        }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(getAccountByJwtMock).toHaveBeenCalledWith("signed.jwt");
    expect(encodeMock).toHaveBeenCalledWith({
      salt: "__Secure-authjs.session-token",
      secret: "mixtv-development-auth-secret",
      token: {
        accessToken: "signed.jwt",
        admin: true,
        id: "admin",
        name: "管理员",
        sub: "admin",
      },
    });
    expect(response.headers.get("set-cookie")).toContain(
      "__Secure-authjs.session-token=auth-session-token",
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });
});
