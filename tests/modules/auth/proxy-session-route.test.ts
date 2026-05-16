import { beforeEach, describe, expect, it, vi } from "vitest";
import * as route from "@/app/api/auth/proxy-session/route";

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
  auth: authMock,
}));

describe("proxy session API route", () => {
  beforeEach(() => {
    authMock.mockReset();
  });

  it("returns no content for an authenticated session", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });

    const response = await route.GET();

    expect(response.status).toBe(204);
  });

  it("returns unauthorized without an authenticated session", async () => {
    authMock.mockResolvedValue(null);

    const response = await route.GET();

    expect(response.status).toBe(401);
  });
});
