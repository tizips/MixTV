import { describe, expect, it, vi } from "vitest";
import * as authRoute from "@/app/api/auth/[...nextauth]/route";

vi.mock("@/auth", () => ({
  handlers: {
    GET: vi.fn(),
    POST: vi.fn(),
  },
}));

describe("NextAuth route", () => {
  it("uses the Edge runtime for Cloudflare Pages request compatibility", () => {
    expect(authRoute.runtime).toBe("edge");
  });
});
