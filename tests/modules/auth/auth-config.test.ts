import { afterEach, describe, expect, it, vi } from "vitest";

const nextAuthMock = vi.hoisted(() => vi.fn(() => ({
  auth: vi.fn(),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
})));

vi.mock("next-auth", () => ({
  default: nextAuthMock,
}));

vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn((config) => ({
    ...config,
    id: "credentials",
    type: "credentials",
  })),
}));

describe("NextAuth config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    nextAuthMock.mockClear();
  });

  it("uses secure cookies in production so proxy reads the same session token set by HTTPS callbacks", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await import("@/auth");

    expect(nextAuthMock).toHaveBeenCalledWith(
      expect.objectContaining({
        useSecureCookies: true,
      }),
    );
  });
});
