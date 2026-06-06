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
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
    nextAuthMock.mockClear();
  });

  it("does not read process env during synchronous auth initialization", async () => {
    vi.stubEnv("AUTH_SECRET", "process-secret");
    vi.stubEnv("NODE_ENV", "production");

    await import("@/auth");

    expect(nextAuthMock).toHaveBeenCalledWith(
      expect.objectContaining({
        secret: "mixtv-development-auth-secret",
      }),
    );
    expect(nextAuthMock.mock.calls[0]?.[0]).not.toHaveProperty("useSecureCookies");
  });

  it("does not require process to exist during synchronous auth initialization", async () => {
    vi.stubGlobal("process", undefined);

    await import("@/auth");

    expect(nextAuthMock).toHaveBeenCalledWith(
      expect.objectContaining({
        secret: "mixtv-development-auth-secret",
      }),
    );
    expect(nextAuthMock.mock.calls[0]?.[0]).not.toHaveProperty("useSecureCookies");
  });
});
