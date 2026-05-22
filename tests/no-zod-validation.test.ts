import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const projectRoot = process.cwd();

const sourceFiles = [
  "src/app/admin/cloud-search-panel.tsx",
  "src/app/admin/danmaku-panel.tsx",
  "src/app/admin/homepage-config-panel.tsx",
  "src/app/admin/timing-management-panel.tsx",
];

function readProjectFile(path: string) {
  return readFileSync(join(projectRoot, path), "utf8");
}

describe("Client-side Zod validation removal", () => {
  test("admin panels do not import or reference Zod validation", () => {
    for (const file of sourceFiles) {
      expect(readProjectFile(file), file).not.toMatch(/\bzod\b|Zod|from ["']zod["']/);
    }
  });
});
