import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { SiteHeader } from "./site-header";
import { env } from "@/shared/env";

const navigationMock = vi.hoisted(() => ({
  pathname: "/search",
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationMock.pathname,
  useRouter: () => ({
    push: navigationMock.push,
  }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch, ...props }: { href: string; children: ReactNode; prefetch?: boolean }) => (
    <a data-prefetch={String(prefetch ?? true)} href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

describe("SiteHeader", () => {
  beforeEach(() => {
    navigationMock.pathname = "/search";
    navigationMock.push.mockClear();
  });

  it("renders the enabled main navigation with the theme toggle before the user menu", () => {
    const html = renderToStaticMarkup(<SiteHeader isAdmin userName="橘子" />);

    expect(html).toContain(env.NEXT_PUBLIC_SITE_NAME);
    expect(html).toContain("首页");
    expect(html).toContain("搜索");
    expect(html).not.toContain("源浏览器");
    expect(html).not.toContain("电影");
    expect(html).not.toContain("剧集");
    expect(html).not.toContain("动漫");
    expect(html).not.toContain("综艺");
    expect(html).toContain("主题切换初始化中");
    expect(html).toContain("打开个人中心");
    expect(html.indexOf("主题切换初始化中")).toBeLessThan(html.indexOf("打开个人中心"));
    expect(html).not.toContain("bg-white/70");
    expect(html).not.toContain("border-(--border)");
    expect(html).toContain("bg-surface/80");
    expect(html).toContain("backdrop-blur-2xl");
    expect(html).toContain("backdrop-saturate-150");
    expect(html).toContain('data-icon="user"');
    expect(html).toContain("aria-label=\"打开个人中心\"");
  });

  it("preserves the active navigation destination", () => {
    const html = renderToStaticMarkup(<SiteHeader isAdmin userName="橘子" />);

    expect(html).toContain('href="/search"');
    expect(html).not.toContain('href="/movies"');
  });

  it("renders native navigation with an active underline and hover capsules", () => {
    const html = renderToStaticMarkup(<SiteHeader isAdmin userName="橘子" />);

    expect(html).toContain('aria-label="主导航"');
    expect(html).toContain("border-accent");
    expect(html).toContain("border-transparent");
    expect(html).toContain("rounded-full");
    expect(html).toContain("hover:bg-foreground/5");
    expect(html).toContain('data-prefetch="false"');
    expect(html).not.toContain('data-slot="tabs-indicator"');
    expect(html).not.toContain('aria-selected="true"');
  });
});
