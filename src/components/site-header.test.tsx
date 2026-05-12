import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { SiteHeader } from "./site-header";

vi.mock("next/navigation", () => ({
  usePathname: () => "/movies",
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("SiteHeader", () => {
  it("renders the shared navigation with the theme toggle before the user menu", () => {
    const html = renderToStaticMarkup(<SiteHeader />);

    expect(html).toContain("MixTV");
    expect(html).toContain("首页");
    expect(html).toContain("搜索");
    expect(html).toContain("源浏览器");
    expect(html).toContain("电影");
    expect(html).toContain("主题切换初始化中");
    expect(html).toContain("打开个人中心");
    expect(html.indexOf("主题切换初始化中")).toBeLessThan(html.indexOf("打开个人中心"));
    expect(html).not.toContain("bg-white/70");
    expect(html).toContain("bg-[var(--layout-panel-background)]");
    expect(html).toContain("border-[var(--layout-panel-border)]");
    expect(html).toContain("shadow-[var(--layout-panel-shadow)]");
    expect(html).toContain("bi-person");
    expect(html).toContain("aria-label=\"打开个人中心\"");
  });

  it("preserves the active navigation destination", () => {
    const html = renderToStaticMarkup(<SiteHeader />);

    expect(html).toContain('href="/movies"');
  });

  it("renders native navigation with an active underline and hover capsules", () => {
    const html = renderToStaticMarkup(<SiteHeader />);

    expect(html).toContain('aria-label="主导航"');
    expect(html).toContain("border-accent");
    expect(html).toContain("border-transparent");
    expect(html).toContain("rounded-full");
    expect(html).toContain("hover:bg-foreground/5");
    expect(html).not.toContain('data-slot="tabs-indicator"');
    expect(html).not.toContain('aria-selected="true"');
  });
});
