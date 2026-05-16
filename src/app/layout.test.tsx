import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RootLayout from "./layout";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: {
      name: "橘子",
      admin: true,
      id: "orange",
    },
  })),
}));

vi.mock("@/components/site-header", () => ({
  SiteHeader: () => <header data-testid="site-header" />,
}));

vi.mock("holy-loader", () => ({
  default: (props: {
    boxShadow?: string;
    color?: string;
    height?: string;
    showSpinner?: boolean;
  }) => <div data-testid="holy-loader" data-color={props.color} data-height={props.height} data-show-spinner={String(props.showSpinner)} />,
}));

vi.mock("@/app/providers", () => ({
  Providers: ({ children }: { children: ReactNode }) => (
    <div data-testid="theme-provider" data-storage-key="mixtv-theme-mode">
      {children}
    </div>
  ),
}));

describe("RootLayout", () => {
  it("mounts the fixed header and page content", async () => {
    const html = renderToStaticMarkup(
      await RootLayout({
        children: <div data-testid="page-child">child</div>,
      }),
    );

    expect(html).toContain('data-storage-key="mixtv-theme-mode"');
    expect(html).toContain('class="text-foreground"');
    expect(html).toContain('class="min-h-[calc(100dvh+4rem)] pt-16"');
    expect(html).toContain("holy-loader");
    expect(html).toContain('data-color="var(--accent)"');
    expect(html).toContain('data-height="2px"');
    expect(html).toContain('data-show-spinner="false"');
    expect(html).toContain("site-header");
    expect(html).toContain("page-child");
  });
});
