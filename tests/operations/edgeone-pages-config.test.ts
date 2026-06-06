import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type EdgeOnePagesConfig = {
  buildCommand?: string;
  installCommand?: string;
  nodeVersion?: string;
  outputDirectory?: string;
};

describe("EdgeOne Pages deployment config", () => {
  it("uses the Next.js full-stack output with Bun and a supported Node runtime", () => {
    const config = JSON.parse(
      readFileSync("edgeone.json", "utf8"),
    ) as EdgeOnePagesConfig;

    expect(config).toMatchObject({
      buildCommand: "bun run build",
      installCommand: "bun install --frozen-lockfile",
      nodeVersion: "22.11.0",
      outputDirectory: ".next",
    });
  });
});
