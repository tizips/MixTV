// tests/modules/auth/permissions.test.ts
import { describe, expect, it } from "vitest";
import { hasPermission } from "@/modules/auth";

describe("hasPermission", () => {
  it("returns true when permission exists", () => {
    const result = hasPermission(["admin:read", "admin:write"], "admin:write");
    expect(result).toBe(true);
  });

  it("returns false when permission is missing", () => {
    const result = hasPermission(["content:read"], "admin:write");
    expect(result).toBe(false);
  });
});
