import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LoadingOverlay } from "./loading-overlay";

describe("LoadingOverlay", () => {
  it("renders tokenized loading chrome when visible", () => {
    const html = renderToStaticMarkup(<LoadingOverlay isLoading />);

    expect(html).toContain("color-mix(in srgb, var(--homepage-bg) 80%, transparent)");
    expect(html).toContain("background-color:var(--homepage-surface)");
    expect(html).toContain("border-color:var(--homepage-border)");
    expect(html).toContain("border-top-color:var(--homepage-text)");
    expect(html).toContain("color:var(--homepage-text)");
  });

  it("renders nothing when hidden", () => {
    const html = renderToStaticMarkup(<LoadingOverlay isLoading={false} />);

    expect(html).toBe("");
  });
});
