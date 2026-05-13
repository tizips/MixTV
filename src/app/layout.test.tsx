import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RootLayout from "./layout";

vi.mock("@/components/site-header", () => ({
  SiteHeader: () => <header data-testid="site-header" />,
}));

vi.mock("@/app/providers", () => ({
  Providers: ({ children }: { children: ReactNode }) => (
    <div data-testid="theme-provider" data-storage-key="mixtv-theme-mode">
      {children}
    </div>
  ),
}));

describe("RootLayout", () => {
  it("mounts the fixed header and page content", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <div data-testid="page-child">child</div>
      </RootLayout>,
    );

    expect(html).toContain('data-storage-key="mixtv-theme-mode"');
    expect(html).toContain('class="text-foreground"');
    expect(html).toContain('class="min-h-[calc(100dvh+4rem)] pt-16"');
    expect(html).toContain("site-header");
    expect(html).toContain("page-child");
  });
});
