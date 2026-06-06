import { describe, expect, it, vi } from "vitest";
import * as authRoute from "@/app/api/auth/[...nextauth]/route";

vi.mock("@/auth", () => ({
  handlers: {
    GET: vi.fn(),
    POST: vi.fn(),
  },
}));

describe("NextAuth route", () => {
  it("uses the Node runtime so EdgeOne KV bindings can be prepared for NextAuth", () => {
    expect(authRoute.runtime).toBe("nodejs");
  });
});
