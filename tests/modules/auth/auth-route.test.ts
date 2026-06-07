import { describe, expect, it, vi } from "vitest";
import * as authRoute from "@/app/api/auth/[...nextauth]/route";

const getHandlerMock = vi.hoisted(() => vi.fn());
const postHandlerMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
  handlers: {
    GET: getHandlerMock,
    POST: postHandlerMock,
  },
}));

describe("NextAuth route", () => {
  it("uses the Node runtime so EdgeOne KV bindings can be prepared for NextAuth", () => {
    expect(authRoute.runtime).toBe("nodejs");
  });

  it("short-circuits credentials callback POSTs before Auth.js reads the request body", async () => {
    const response = await authRoute.POST(
      new Request("https://tv.herhu.com/api/auth/callback/credentials", {
        body: new URLSearchParams({
          password: "Secret@123",
          username: "admin",
        }),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      }),
    );

    await expect(response.json()).resolves.toEqual({
      url: "https://tv.herhu.com/login?error=CredentialsSignin&code=credentials",
    });
    expect(response.status).toBe(400);
    expect(postHandlerMock).not.toHaveBeenCalled();
  });
});
