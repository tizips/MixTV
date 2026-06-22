import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readGlobalCss() {
  return readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
}

describe("playback floating controls CSS", () => {
  it("aligns the fullscreen progress bar with matching left and right inset", () => {
    const css = readGlobalCss();

    expect(css).toContain("--mixtv-playback-island-inline-padding: 0.6rem;");
    expect(css).toContain("--mixtv-playback-progress-inline-inset: 0.15rem;");
    expect(css).toContain(
      "padding: 0.45rem var(--mixtv-playback-island-inline-padding) 0.5rem !important;",
    );
    expect(css).toContain(
      "width: calc(100% - (var(--mixtv-playback-progress-inline-inset) * 2)) !important;",
    );
    expect(css).toContain("margin-inline: var(--mixtv-playback-progress-inline-inset) !important;");
    expect(css).toContain("margin-inline: 0 !important;");
  });
});
