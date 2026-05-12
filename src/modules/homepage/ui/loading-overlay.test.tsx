import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LoadingOverlay } from "./loading-overlay";

describe("LoadingOverlay", () => {
  it("renders tokenized loading chrome when visible", () => {
    const html = renderToStaticMarkup(<LoadingOverlay isLoading />);

    expect(html).toContain("bg-backdrop");
    expect(html).toContain("bg-surface");
    expect(html).toContain("border-border");
    expect(html).toContain("border-t-accent");
    expect(html).toContain("text-foreground");
  });

  it("renders nothing when hidden", () => {
    const html = renderToStaticMarkup(<LoadingOverlay isLoading={false} />);

    expect(html).toBe("");
  });
});
