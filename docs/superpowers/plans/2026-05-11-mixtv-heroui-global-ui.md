# MixTV HeroUI Global UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the full MixTV UI layer with HeroUI components and shift the site to a standard light, neutral presentation without changing route structure or business logic.

**Architecture:** Treat `src/app/layout.tsx` as the HeroUI integration root, keep business logic in `src/modules/*`, and migrate only presentation layers and shell components. Replace the bespoke dark theme and custom chrome with HeroUI provider, surfaces, navigation, dropdowns, tabs, cards, buttons, inputs, and switches, while preserving all current routes and data flow.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Tailwind CSS v4, `@heroui/react`, `@heroui/styles`.

---

## File Structure Map

- Modify: `package.json`, `package-lock.json` - add HeroUI dependencies.
- Modify: `src/app/layout.tsx` - mount the HeroUI provider and remove the old global shell styling.
- Modify: `src/app/globals.css` - remove the bespoke theme variables and background gradients.
- Modify: `src/app/layout.test.tsx` - verify the root layout now wraps the app with HeroUI and no longer depends on old theme classes.
- Modify: `src/components/site-header.tsx` - rebuild the shell header with HeroUI navbar and menu primitives.
- Modify: `src/components/site-header.test.tsx` - assert the new header output no longer contains the old custom shell classes or theme toggle.
- Modify: `src/components/user-menu.tsx` - rebuild the user menu with HeroUI dropdown/menu primitives.
- Modify: `src/components/user-menu.test.tsx` - assert the menu still exposes the same actions without the old divider-only markup.
- Delete: `src/components/theme-toggle.tsx` - the global light-neutral HeroUI shell does not need the legacy theme toggle.
- Modify: `src/modules/homepage/ui/homepage-shell.tsx` - swap homepage wrappers to HeroUI surfaces.
- Modify: `src/modules/homepage/ui/welcome-banner.tsx` - convert the welcome banner to a HeroUI card/surface.
- Modify: `src/modules/homepage/ui/loading-overlay.tsx` - replace the custom overlay with HeroUI loading feedback.
- Modify: `src/modules/homepage/ui/hero-banner.tsx` - restyle the hero banner using HeroUI surfaces and controls.
- Modify: `src/modules/homepage/ui/content-carousel.tsx` - restyle section headers and horizontal lists with HeroUI primitives.
- Modify: `src/modules/homepage/ui/content-card.tsx` - replace the custom content card chrome with HeroUI card/button/chip patterns.
- Modify: `src/modules/homepage/ui/homepage-shell.test.tsx`, `src/modules/homepage/ui/content-card.test.tsx`, `src/modules/homepage/ui/content-carousel.test.tsx`, `src/modules/homepage/ui/welcome-banner.test.tsx`, `src/modules/homepage/ui/loading-overlay.test.tsx`, `src/modules/homepage/ui/hero-banner.test.tsx` - update assertions to the HeroUI presentation.
- Modify: `src/components/placeholder-page.tsx` - turn the generic placeholder page into a HeroUI container/card surface.
- Add: `src/app/placeholder-routes.test.tsx` - smoke-test every placeholder route page and confirm the old custom theme classes are gone.
- Modify: `src/app/admin/page.tsx` - make the admin shell use HeroUI layout/surface primitives.
- Modify: `src/app/admin/admin-tabs.tsx` - replace custom tab buttons with HeroUI tabs and buttons.
- Modify: `src/app/admin/site-config-panel.tsx` - replace custom form controls with HeroUI inputs, textarea, select, switch, and button components.
- Modify: `src/app/admin/page.test.tsx` - keep the admin content assertions and drop expectations tied to the old shell classes.
- Modify: `src/app/admin/site-config-panel.test.tsx` - keep the field coverage while removing dependence on the old custom markup.

## Task 1: Wire HeroUI Into The App Root

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.test.tsx`

- [ ] **Step 1: Write the failing root-shell test**

```tsx
// src/app/layout.test.tsx
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
import RootLayout from "./layout";

vi.mock("@heroui/react", () => ({
  HeroUIProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="heroui-provider">{children}</div>
  ),
}));

vi.mock("@/components/site-header", () => ({
  SiteHeader: () => <header data-testid="site-header" />,
}));

describe("RootLayout", () => {
  it("wraps the app with HeroUI and drops the legacy theme shell", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <div data-testid="page-child">child</div>
      </RootLayout>,
    );
    const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

    expect(html).toContain("data-testid=\"heroui-provider\"");
    expect(html).toContain("site-header");
    expect(html).toContain("page-child");
    expect(html).not.toContain("bg-[var(--homepage-bg)]");
    expect(html).not.toContain("data-theme=");
    expect(css).not.toContain("--homepage-bg");
    expect(css).not.toContain("--homepage-text");
    expect(css).not.toContain("prefers-color-scheme");
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- src/app/layout.test.tsx`

Expected: FAIL because the current layout still uses the old shell and theme CSS.

- [ ] **Step 3: Add the HeroUI root integration**

```tsx
// src/app/layout.tsx
import type { ReactNode } from "react";
import { HeroUIProvider } from "@heroui/react";
import "@heroui/styles";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-dvh bg-background text-foreground">
        <HeroUIProvider>
          <SiteHeader />
          <main className="pt-16">{children}</main>
        </HeroUIProvider>
      </body>
    </html>
  );
}
```

```css
/* src/app/globals.css */
@import "tailwindcss";

html,
body {
  min-height: 100%;
}

body {
  margin: 0;
}

/* Hide scrollbar for horizontal carousels */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm test -- src/app/layout.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/app/layout.tsx src/app/globals.css src/app/layout.test.tsx
git commit -m "feat: wire HeroUI into the app root"
```

## Task 2: Replace The Shared Header And User Menu

**Files:**
- Modify: `src/components/site-header.tsx`
- Modify: `src/components/site-header.test.tsx`
- Modify: `src/components/user-menu.tsx`
- Modify: `src/components/user-menu.test.tsx`
- Delete: `src/components/theme-toggle.tsx`

- [ ] **Step 1: Write failing shell tests that forbid the old chrome**

```tsx
// src/components/site-header.test.tsx
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { SiteHeader } from "./site-header";

vi.mock("next/navigation", () => ({
  usePathname: () => "/movies",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("SiteHeader", () => {
  it("renders the shared navigation without the legacy theme toggle shell", () => {
    const html = renderToStaticMarkup(<SiteHeader />);

    expect(html).toContain("MixTV");
    expect(html).toContain("首页");
    expect(html).toContain("搜索");
    expect(html).toContain("电影");
    expect(html).toContain("源浏览器");
    expect(html).toContain("打开个人中心");
    expect(html).not.toContain("切换主题，当前");
    expect(html).not.toContain("bg-white/70");
    expect(html).not.toContain("backdrop-blur-xl");
  });
});
```

```tsx
// src/components/user-menu.test.tsx
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { UserMenu } from "./user-menu";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("UserMenu", () => {
  it("renders the same actions through HeroUI menu primitives", () => {
    const html = renderToStaticMarkup(<UserMenu userName="橘子" isAdmin />);

    expect(html).toContain("当前用户");
    expect(html).toContain("橘子");
    expect(html).toContain("站长");
    expect(html).toContain("更新提醒");
    expect(html).toContain("继续观看");
    expect(html).toContain("我的收藏");
    expect(html).toContain("管理面板");
    expect(html).toContain("播放统计");
    expect(html).toContain("上映日程");
    expect(html).toContain("登出");
    expect(html).toContain("版本信息");
    expect(html).not.toContain("h-px bg-black/20");
    expect(html).not.toContain("h-px bg-black/15");
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm test -- src/components/site-header.test.tsx src/components/user-menu.test.tsx`

Expected: FAIL because the current header still uses the old custom chrome and the theme toggle is still present.

- [ ] **Step 3: Rebuild the header and user menu with HeroUI components**

```tsx
// src/components/site-header.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Button,
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
} from "@heroui/react";
import { UserMenu } from "@/components/user-menu";

const navItems = [
  { label: "首页", href: "/" },
  { label: "搜索", href: "/search" },
  { label: "源浏览器", href: "/sources" },
  { label: "电影", href: "/movies" },
  { label: "剧集", href: "/series" },
  { label: "动漫", href: "/anime" },
  { label: "综艺", href: "/variety" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <Navbar isBordered className="fixed inset-x-0 top-0 z-50">
      <NavbarBrand>
        <Link href="/" className="text-lg font-semibold tracking-tight">
          MixTV
        </Link>
      </NavbarBrand>

      <NavbarContent justify="center">
        {navItems.map((item) => {
          const active = pathname === item.href;

          return (
            <NavbarItem key={item.href} isActive={active}>
              <Link href={item.href} className={active ? "font-semibold" : ""}>
                {item.label}
              </Link>
            </NavbarItem>
          );
        })}
      </NavbarContent>

      <NavbarContent justify="end">
        <NavbarItem>
          <Button size="sm" variant="flat" as={Link} href="/search">
            搜索
          </Button>
        </NavbarItem>
        <NavbarItem>
          <UserMenu userName="MixTV 用户" isAdmin />
        </NavbarItem>
      </NavbarContent>
    </Navbar>
  );
}
```

```tsx
// src/components/user-menu.tsx
"use client";

import Link from "next/link";
import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Button } from "@heroui/react";

export function UserMenu({ userName, isAdmin = false }: UserMenuProps) {
  const items = [
    { label: "设置", href: "/settings" },
    { label: "更新提醒", href: "/updates" },
    { label: "继续观看", href: "/continue-watching" },
    { label: "我的收藏", href: "/favorites" },
    ...(isAdmin ? [{ label: "管理面板", href: "/admin" }] : []),
    { label: "播放统计", href: "/stats" },
    { label: "上映日程", href: "/release-schedule" },
  ];

  return (
    <Dropdown placement="bottom-end">
      <DropdownTrigger>
        <Button variant="light" aria-label="打开个人中心">
          {userName}
        </Button>
      </DropdownTrigger>
      <DropdownMenu aria-label="个人中心菜单">
        <DropdownItem key="meta" className="pointer-events-none" textValue={userName}>
          当前用户: {userName}
        </DropdownItem>
        {items.map((item) => (
          <DropdownItem key={item.href} as={Link} href={item.href}>
            {item.label}
          </DropdownItem>
        ))}
        <DropdownItem key="logout" as={Link} href="/logout" color="danger">
          登出
        </DropdownItem>
        <DropdownItem key="version" as={Link} href="/version">
          版本信息
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm test -- src/components/site-header.test.tsx src/components/user-menu.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/site-header.tsx src/components/site-header.test.tsx src/components/user-menu.tsx src/components/user-menu.test.tsx src/components/theme-toggle.tsx
git commit -m "feat: move shared shell controls to HeroUI"
```

## Task 3: Rebuild The Homepage Shell On HeroUI Surfaces

**Files:**
- Modify: `src/modules/homepage/ui/homepage-shell.tsx`
- Modify: `src/modules/homepage/ui/welcome-banner.tsx`
- Modify: `src/modules/homepage/ui/loading-overlay.tsx`
- Modify: `src/modules/homepage/ui/hero-banner.tsx`
- Modify: `src/modules/homepage/ui/content-carousel.tsx`
- Modify: `src/modules/homepage/ui/content-card.tsx`
- Modify: `src/modules/homepage/ui/homepage-shell.test.tsx`
- Modify: `src/modules/homepage/ui/content-card.test.tsx`
- Modify: `src/modules/homepage/ui/content-carousel.test.tsx`
- Modify: `src/modules/homepage/ui/welcome-banner.test.tsx`
- Modify: `src/modules/homepage/ui/loading-overlay.test.tsx`
- Modify: `src/modules/homepage/ui/hero-banner.test.tsx`

- [ ] **Step 1: Write failing homepage UI tests that reject the old surface tokens**

```tsx
// src/modules/homepage/ui/homepage-shell.test.tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HomepageShell } from "./homepage-shell";
import { getHomepageData } from "../application/homepage-service";
import { defaultHomepageConfig } from "../domain/homepage-config";

describe("HomepageShell", () => {
  it("renders the homepage with HeroUI surfaces and without the old theme classes", async () => {
    const data = await getHomepageData();
    const html = renderToStaticMarkup(<HomepageShell data={data} />);

    expect(html).toContain("MixTV");
    expect(html).toContain("欢迎");
    expect(html).toContain(data.heroBanner[0].title);
    expect(html).not.toContain("bg-[var(--homepage-bg)]");
    expect(html).not.toContain("text-[var(--homepage-text)]");
  });

  it("hides the welcome banner when disabled in config", async () => {
    const data = await getHomepageData({
      ...defaultHomepageConfig,
      showWelcomeBanner: false,
    });

    const html = renderToStaticMarkup(<HomepageShell data={data} />);

    expect(html).not.toContain("欢迎来到 MixTV");
    expect(html).not.toContain("探索精彩影视内容");
  });
});
```

```tsx
// src/modules/homepage/ui/content-card.test.tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContentCard } from "./content-card";
import { getHomepageData } from "../application/homepage-service";

describe("ContentCard", () => {
  it("renders content without the old card tokens", async () => {
    const data = await getHomepageData();
    const item = data.sections[0].items[0];
    const html = renderToStaticMarkup(<ContentCard item={item} />);

    expect(html).toContain(item.title);
    expect(html).toContain("bi-play-circle");
    expect(html).not.toContain("bg-[var(--homepage-surface-strong)]");
    expect(html).not.toContain("text-[var(--homepage-text)]");
  });
});
```

```tsx
// src/modules/homepage/ui/loading-overlay.test.tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LoadingOverlay } from "./loading-overlay";

describe("LoadingOverlay", () => {
  it("renders HeroUI loading feedback when visible", () => {
    const html = renderToStaticMarkup(<LoadingOverlay isLoading />);

    expect(html).not.toContain("color-mix(in srgb, var(--homepage-bg) 80%, transparent)");
    expect(html).not.toContain("border-top-color:var(--homepage-text)");
    expect(html).toContain("加载中");
  });
});
```

- [ ] **Step 2: Run the homepage tests and verify they fail**

Run: `npm test -- src/modules/homepage/ui/homepage-shell.test.tsx src/modules/homepage/ui/content-card.test.tsx src/modules/homepage/ui/content-carousel.test.tsx src/modules/homepage/ui/welcome-banner.test.tsx src/modules/homepage/ui/loading-overlay.test.tsx src/modules/homepage/ui/hero-banner.test.tsx`

Expected: FAIL because the current homepage shell still uses custom theme variables and bespoke surfaces.

- [ ] **Step 3: Rework the homepage UI to use HeroUI components**

```tsx
// src/modules/homepage/ui/homepage-shell.tsx
"use client";

import { useState } from "react";
import { Card, CardBody, Container } from "@heroui/react";
import type { HomepageData } from "../application/homepage-service";
import { WelcomeBanner } from "./welcome-banner";
import { LoadingOverlay } from "./loading-overlay";
import { HeroBanner } from "./hero-banner";
import { ContentCarousel } from "./content-carousel";

export function HomepageShell({ data, userName }: HomepageShellProps) {
  const [isLoading] = useState(false);
  const [sections, setSections] = useState(data.sections);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());

  // keep the existing favorite and continue-watching behavior

  return (
    <Container className="py-6 md:py-8 lg:py-12">
      <LoadingOverlay isLoading={isLoading} />
      {data.showWelcomeBanner ? <WelcomeBanner userName={userName} /> : null}
      {data.heroBanner.length > 0 ? <HeroBanner items={data.heroBanner} /> : null}
      <Card className="mt-6">
        <CardBody className="gap-6">
          {sections.map((section) => (
            <ContentCarousel
              key={section.key}
              title={section.title}
              icon={section.icon}
              iconClass={section.iconClass}
              items={section.items}
              moreLink={section.moreLink}
              variant={section.key === "continueWatching" ? "continueWatching" : "default"}
              favoriteIds={favoriteIds}
              onFavorite={section.key === "continueWatching" ? toggleFavorite : undefined}
              onDelete={section.key === "continueWatching" ? deleteContinueWatchingItem : undefined}
            />
          ))}
        </CardBody>
      </Card>
    </Container>
  );
}
```

```tsx
// src/modules/homepage/ui/welcome-banner.tsx
import { Card, CardBody, Chip } from "@heroui/react";

export function WelcomeBanner({ userName }: WelcomeBannerProps) {
  const greeting = userName ? `欢迎回来，${userName}` : "欢迎来到 MixTV";

  return (
    <Card className="mb-6">
      <CardBody className="gap-2">
        <Chip variant="flat">MixTV</Chip>
        <h1 className="text-3xl font-bold">{greeting}</h1>
        <p className="text-default-500">探索精彩影视内容</p>
      </CardBody>
    </Card>
  );
}
```

```tsx
// src/modules/homepage/ui/loading-overlay.tsx
import { Modal, ModalContent, Spinner } from "@heroui/react";

export function LoadingOverlay({ isLoading }: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <Modal isOpen hideCloseButton placement="center" backdrop="blur">
      <ModalContent>
        <div className="flex flex-col items-center gap-4 p-6">
          <Spinner size="lg" />
          <p className="text-sm text-default-600">加载中...</p>
        </div>
      </ModalContent>
    </Modal>
  );
}
```

```tsx
// src/modules/homepage/ui/content-card.tsx
import { Card, CardBody, Button, Chip } from "@heroui/react";

export function ContentCard({ item, variant = "default", isFavorite = false, onClick, onFavorite, onDelete }: ContentCardProps) {
  // preserve the existing continue-watching calculations

  return (
    <Card className="w-48 flex-shrink-0" isPressable onPress={onClick}>
      <CardBody className="gap-3">
        <div className="relative aspect-[2/3] overflow-hidden rounded-medium">
          {/* keep the existing image and overlay behavior */}
        </div>
        {isContinueWatching && progress ? <Chip color="danger" variant="flat">EP.{progress.currentEpisode}</Chip> : null}
        <h3 className="line-clamp-2 text-sm font-medium">{item.title}</h3>
        <div className="flex items-center justify-between gap-2">
          {onFavorite ? <Button size="sm" variant="flat" onPress={onFavorite}>收藏</Button> : null}
          {onDelete ? <Button size="sm" variant="flat" color="danger" onPress={onDelete}>删除</Button> : null}
        </div>
      </CardBody>
    </Card>
  );
}
```

```tsx
// src/modules/homepage/ui/content-carousel.tsx
import { Button, Divider, ScrollShadow } from "@heroui/react";

export function ContentCarousel({ title, icon, iconClass, items, moreLink, variant, favoriteIds, onFavorite, onDelete }: ContentCarouselProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{title}</h2>
        {moreLink ? (
          <Button as={Link} href={moreLink} size="sm" variant="light">
            查看更多
          </Button>
        ) : null}
      </div>
      <Divider />
      <ScrollShadow className="flex gap-4 pb-4">
        {items.map((item) => (
          <ContentCard key={item.id} item={item} variant={variant} isFavorite={favoriteIds?.has(item.id)} onFavorite={onFavorite ? () => onFavorite(item.id) : undefined} onDelete={onDelete ? () => onDelete(item.id) : undefined} />
        ))}
      </ScrollShadow>
    </section>
  );
}
```

```tsx
// src/modules/homepage/ui/hero-banner.tsx
import { Button, Card, CardBody, Pagination } from "@heroui/react";

export function HeroBanner({ items }: HeroBannerProps) {
  // keep the existing rotating-item logic

  return (
    <Card className="mb-8 overflow-hidden">
      <CardBody className="gap-6 p-6 md:p-8">
        {/* keep the backdrop image and title/description content */}
        <Pagination total={items.length} page={currentIndex + 1} onChange={(page) => setCurrentIndex(page - 1)} />
      </CardBody>
    </Card>
  );
}
```

- [ ] **Step 4: Run the homepage tests and verify they pass**

Run: `npm test -- src/modules/homepage/ui/homepage-shell.test.tsx src/modules/homepage/ui/content-card.test.tsx src/modules/homepage/ui/content-carousel.test.tsx src/modules/homepage/ui/welcome-banner.test.tsx src/modules/homepage/ui/loading-overlay.test.tsx src/modules/homepage/ui/hero-banner.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/homepage/ui/homepage-shell.tsx src/modules/homepage/ui/welcome-banner.tsx src/modules/homepage/ui/loading-overlay.tsx src/modules/homepage/ui/hero-banner.tsx src/modules/homepage/ui/content-carousel.tsx src/modules/homepage/ui/content-card.tsx src/modules/homepage/ui/homepage-shell.test.tsx src/modules/homepage/ui/content-card.test.tsx src/modules/homepage/ui/content-carousel.test.tsx src/modules/homepage/ui/welcome-banner.test.tsx src/modules/homepage/ui/loading-overlay.test.tsx src/modules/homepage/ui/hero-banner.test.tsx
git commit -m "feat: restyle the homepage with HeroUI surfaces"
```

## Task 4: Convert The Generic Placeholder Routes To HeroUI Surfaces

**Files:**
- Modify: `src/components/placeholder-page.tsx`
- Add: `src/app/placeholder-routes.test.tsx`

The placeholder route pages under `src/app/search/page.tsx`, `src/app/movies/page.tsx`, `src/app/sources/page.tsx`, `src/app/series/page.tsx`, `src/app/anime/page.tsx`, `src/app/variety/page.tsx`, `src/app/settings/page.tsx`, `src/app/favorites/page.tsx`, `src/app/continue-watching/page.tsx`, `src/app/updates/page.tsx`, `src/app/logout/page.tsx`, `src/app/version/page.tsx`, `src/app/release-schedule/page.tsx`, and `src/app/stats/page.tsx` already consume this shared component and should not need direct edits unless a route-specific copy changes later.

- [ ] **Step 1: Write a route smoke test that covers every placeholder page**

```tsx
// src/app/placeholder-routes.test.tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import SearchPage from "@/app/search/page";
import MoviesPage from "@/app/movies/page";
import SourcesPage from "@/app/sources/page";
import SeriesPage from "@/app/series/page";
import AnimePage from "@/app/anime/page";
import VarietyPage from "@/app/variety/page";
import SettingsPage from "@/app/settings/page";
import FavoritesPage from "@/app/favorites/page";
import ContinueWatchingPage from "@/app/continue-watching/page";
import UpdatesPage from "@/app/updates/page";
import LogoutPage from "@/app/logout/page";
import VersionPage from "@/app/version/page";
import ReleaseSchedulePage from "@/app/release-schedule/page";
import StatsPage from "@/app/stats/page";

const placeholderRoutes = [
  SearchPage,
  MoviesPage,
  SourcesPage,
  SeriesPage,
  AnimePage,
  VarietyPage,
  SettingsPage,
  FavoritesPage,
  ContinueWatchingPage,
  UpdatesPage,
  LogoutPage,
  VersionPage,
  ReleaseSchedulePage,
  StatsPage,
] as const;

describe("placeholder routes", () => {
  it("renders every placeholder route through the shared HeroUI shell", async () => {
    for (const Page of placeholderRoutes) {
      const html = renderToStaticMarkup(await Page());
      expect(html).not.toContain("bg-[var(--homepage-surface)]");
      expect(html).not.toContain("text-[var(--homepage-text)]");
    }
  });
});
```

- [ ] **Step 2: Run the smoke test and verify it fails**

Run: `npm test -- src/app/placeholder-routes.test.tsx`

Expected: FAIL because the shared placeholder component still renders the old custom shell.

- [ ] **Step 3: Convert the shared placeholder page to HeroUI**

```tsx
// src/components/placeholder-page.tsx
import { Card, CardBody, Chip, Container } from "@heroui/react";

type PlaceholderPageProps = {
  title: string;
  description: string;
};

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <Container className="py-12">
      <Card className="mx-auto max-w-4xl">
        <CardBody className="gap-4 py-10 text-center">
          <Chip variant="flat">MixTV</Chip>
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">{title}</h1>
          <p className="mx-auto max-w-2xl text-base leading-7 text-default-500 md:text-lg">
            {description}
          </p>
        </CardBody>
      </Card>
    </Container>
  );
}
```

- [ ] **Step 4: Run the smoke test and verify it passes**

Run: `npm test -- src/app/placeholder-routes.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/placeholder-page.tsx src/app/placeholder-routes.test.tsx
git commit -m "feat: render placeholder routes with HeroUI"
```

## Task 5: Convert The Admin Area To HeroUI Components

**Files:**
- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/admin/admin-tabs.tsx`
- Modify: `src/app/admin/site-config-panel.tsx`
- Modify: `src/app/admin/page.test.tsx`
- Modify: `src/app/admin/site-config-panel.test.tsx`

- [ ] **Step 1: Write failing admin tests that reject the old custom tab and form chrome**

```tsx
// src/app/admin/page.test.tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AdminPage from "@/app/admin/page";

describe("AdminPage", () => {
  it("renders the admin content without the old custom surface classes", async () => {
    const html = renderToStaticMarkup(await AdminPage());

    expect(html).toContain("管理面板");
    expect(html).toContain("配置文件");
    expect(html).toContain("站点配置");
    expect(html).toContain("首页模块");
    expect(html).toContain("性能监控");
    expect(html).not.toContain("bg-[var(--homepage-surface)]");
    expect(html).not.toContain("border-white/10");
  });
});
```

```tsx
// src/app/admin/site-config-panel.test.tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteConfigPanel } from "./site-config-panel";

describe("SiteConfigPanel", () => {
  it("renders the configuration fields without the custom switches and inputs", () => {
    const html = renderToStaticMarkup(<SiteConfigPanel />);

    expect(html).toContain("站点名称");
    expect(html).toContain("站点公告");
    expect(html).toContain("豆瓣数据代理");
    expect(html).toContain("豆瓣图片代理");
    expect(html).toContain("豆瓣认证");
    expect(html).toContain("启用关键词过滤");
    expect(html).toContain("显示成人内容");
    expect(html).toContain("启用流式搜索");
    expect(html).toContain("保存配置");
    expect(html).not.toContain("rounded-2xl border border-zinc-800/60");
    expect(html).not.toContain("bg-[var(--homepage-surface)]");
  });
});
```

- [ ] **Step 2: Run the admin tests and verify they fail**

Run: `npm test -- src/app/admin/page.test.tsx src/app/admin/site-config-panel.test.tsx`

Expected: FAIL because the current admin area still uses the old bespoke tab and form chrome.

- [ ] **Step 3: Rebuild the admin shell with HeroUI tabs, cards, inputs, and switches**

```tsx
// src/app/admin/page.tsx
import { Container, Card, CardBody } from "@heroui/react";
import { AdminTabs } from "./admin-tabs";

export default function AdminPage() {
  return (
    <Container className="py-8">
      <Card>
        <CardBody className="gap-2">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-default-500">
            MixTV Admin
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">管理面板</h1>
          <p className="max-w-3xl text-sm leading-7 text-default-500 md:text-base">
            这里汇总站点后台能力，当前先提供 tab 骨架，后续可逐步接入真实配置、列表和操作表单。
          </p>
        </CardBody>
      </Card>

      <AdminTabs />
    </Container>
  );
}
```

```tsx
// src/app/admin/admin-tabs.tsx
"use client";

import { useState } from "react";
import { Button, Card, CardBody, Tab, Tabs } from "@heroui/react";
import { SiteConfigPanel } from "./site-config-panel";

export function AdminTabs() {
  const [activeTab, setActiveTab] = useState<(typeof adminTabs)[number]["key"]>(adminTabs[0].key);
  const currentTab = adminTabs.find((tab) => tab.key === activeTab) ?? adminTabs[0];

  return (
    <Tabs selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(key as typeof activeTab)} className="mt-8">
      {adminTabs.map((tab) => (
        <Tab key={tab.key} title={tab.label}>
          {tab.key === "config-files" ? (
            <ConfigFilesPanel />
          ) : tab.key === "site-config" ? (
            <SiteConfigPanel />
          ) : (
            <Card>
              <CardBody className="gap-6">
                <div>
                  <p className={`text-sm font-medium uppercase tracking-[0.28em] ${tab.accent}`}>当前分类</p>
                  <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{tab.label}</h2>
                  <p className="text-sm leading-7 text-default-500 md:text-base">{tab.description}</p>
                </div>
                <div className="flex gap-3">
                  <Button color="primary">进入管理</Button>
                  <Button variant="flat">刷新状态</Button>
                </div>
              </CardBody>
            </Card>
          )}
        </Tab>
      ))}
    </Tabs>
  );
}
```

```tsx
// src/app/admin/site-config-panel.tsx
"use client";

import { useState } from "react";
import { Button, Card, CardBody, Input, Select, SelectItem, Switch, Textarea } from "@heroui/react";

export function SiteConfigPanel({ initialValues }: { initialValues?: Partial<SiteConfigFormValues> }) {
  const [values, setValues] = useState(() => mergeInitialValues(initialValues));
  const [saveMessage, setSaveMessage] = useState("尚未保存更改");

  return (
    <Card className="mt-8">
      <CardBody className="gap-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">站点配置</h2>
            <p className="max-w-3xl text-sm leading-7 text-default-500 md:text-base">
              这里维护站点基础信息、豆瓣代理和全站开关，当前保存行为通过 Mock API 模拟。
            </p>
          </div>
          <div className="rounded-2xl bg-default-100 px-4 py-3 text-sm text-default-500">{saveMessage}</div>
        </div>

        <form className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
          <div className="space-y-6">
            <Input label="站点名称" value={values.siteName} onValueChange={(siteName) => setValues((current) => ({ ...current, siteName }))} />
            <Textarea label="站点公告" value={values.siteAnnouncement} onValueChange={(siteAnnouncement) => setValues((current) => ({ ...current, siteAnnouncement }))} minRows={5} />
            <Select label="豆瓣数据代理" selectedKeys={[values.doubanDataProxyMode]} onSelectionChange={(keys) => setValues((current) => ({ ...current, doubanDataProxyMode: Array.from(keys)[0] as ProxyMode }))}>
              {proxyOptions.map((option) => <SelectItem key={option.value}>{option.label}</SelectItem>)}
            </Select>
            <Select label="豆瓣图片代理" selectedKeys={[values.doubanImageProxyMode]} onSelectionChange={(keys) => setValues((current) => ({ ...current, doubanImageProxyMode: Array.from(keys)[0] as ProxyMode }))}>
              {imageProxyOptions.map((option) => <SelectItem key={option.value}>{option.label}</SelectItem>)}
            </Select>
            <Textarea label="豆瓣认证" value={values.doubanAuth} onValueChange={(doubanAuth) => setValues((current) => ({ ...current, doubanAuth }))} minRows={5} />
          </div>

          <aside className="space-y-6 rounded-3xl bg-default-100 p-5">
            <Switch isSelected={values.enableKeywordFilter} onValueChange={(enableKeywordFilter) => setValues((current) => ({ ...current, enableKeywordFilter }))}>启用关键词过滤</Switch>
            <Switch isSelected={values.showAdultContent} onValueChange={(showAdultContent) => setValues((current) => ({ ...current, showAdultContent }))}>显示成人内容</Switch>
            <Switch isSelected={values.enableStreamingSearch} onValueChange={(enableStreamingSearch) => setValues((current) => ({ ...current, enableStreamingSearch }))}>启用流式搜索</Switch>
            <Button color="primary" type="button">保存配置</Button>
          </aside>
        </form>
      </CardBody>
    </Card>
  );
}
```

- [ ] **Step 4: Run the admin tests and verify they pass**

Run: `npm test -- src/app/admin/page.test.tsx src/app/admin/site-config-panel.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/page.tsx src/app/admin/admin-tabs.tsx src/app/admin/site-config-panel.tsx src/app/admin/page.test.tsx src/app/admin/site-config-panel.test.tsx
git commit -m "feat: restyle the admin area with HeroUI"
```

## Final Validation

**Files:**
- All files modified by the tasks above.


- [ ] **Step 1: Check for leftover legacy theme references**

Run: `rg -n "ThemeToggle|data-theme|--homepage-bg|--homepage-text|prefers-color-scheme" src`

Expected: no remaining matches in the app source tree after the migration.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 4: Build production output**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit any final fixes**

```bash
git add .
git commit -m "feat: complete the HeroUI global UI migration"
```

## Self-Review Checklist

- Spec coverage: root HeroUI integration, shared header/menu, homepage shell, placeholder routes, and admin pages all have dedicated tasks.
- Placeholder scan: no TBD or TODO placeholders remain in the plan text.
- Type consistency: component names and test file names match the files named in the task headers.
- Scope check: the plan stays focused on UI migration and does not expand into business logic or route changes.
