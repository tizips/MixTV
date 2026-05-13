import { describe, expect, it } from "vitest";

import {
  buildPlaceholderImageSvg,
  createPlaceholderImageUrl,
  pickPlaceholderImageColor,
} from "./placeholder-image";

describe("placeholder-image", () => {
  it("builds route URLs without exposing a raw color query", () => {
    expect(
      createPlaceholderImageUrl({
        variant: "poster",
        fileStem: "流浪地球2",
        seed: "hero-1",
      }),
    ).toBe("/assets/placeholders/poster/%E6%B5%81%E6%B5%AA%E5%9C%B0%E7%90%832.svg?seed=hero-1");
  });

  it("picks a stable palette color for the same seed", () => {
    expect(pickPlaceholderImageColor("hero-1")).toBe(pickPlaceholderImageColor("hero-1"));
    expect(["1a1a2e", "16213e", "0f3460", "533483", "6a2c70", "2d4059"]).toContain(
      pickPlaceholderImageColor("hero-1"),
    );
  });

  it("renders escaped SVG content using the built-in palette", () => {
    const svg = buildPlaceholderImageSvg({
      variant: "backdrop",
      file: "A&B<test>.svg",
      seed: "hero-1",
    });

    expect(svg).toContain('width="1920"');
    expect(svg).toContain("A&amp;B&lt;test&gt;");
    expect(svg).toContain(`#${pickPlaceholderImageColor("hero-1")}`);
  });
});
