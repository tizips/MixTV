// tests/architecture/folder-layout.test.ts
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

const requiredPaths = [
  "src/app",
  "src/modules/auth/domain",
  "src/modules/auth/application",
  "src/modules/auth/infrastructure",
  "src/modules/auth/server",
  "src/modules/auth/ui",
  "src/shared/db",
  "src/integrations/tmdb",
  "src/infrastructure/db",
];

describe("folder layout", () => {
  it("matches modular-monolith base structure", () => {
    for (const p of requiredPaths) {
      expect(existsSync(p)).toBe(true);
    }
  });
});
