# MixTV 首页 UI 结构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MixTV homepage shell described in `docs/features/HOME_PAGE_MODULES.md` with a module-based structure, Mock 数据, Netflix 风格布局和磨砂玻璃视觉效果。

**Architecture:** Keep homepage concerns inside `src/modules/homepage` and let `src/app/page.tsx` only fetch and compose. Domain files define the data contract, application files shape and filter the mock homepage payload, and UI files render isolated sections that can later swap to real data sources without changing page composition.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Vitest.

---

## File Map

### New module files

- Create: `src/modules/homepage/domain/homepage-config.ts`
- Create: `src/modules/homepage/domain/content-types.ts`
- Create: `src/modules/homepage/domain/section-types.ts`
- Create: `src/modules/homepage/application/mock-data-provider.ts`
- Create: `src/modules/homepage/application/homepage-service.ts`
- Create: `src/modules/homepage/ui/loading-overlay.tsx`
- Create: `src/modules/homepage/ui/welcome-banner.tsx`
- Create: `src/modules/homepage/ui/content-card.tsx`
- Create: `src/modules/homepage/ui/content-carousel.tsx`
- Create: `src/modules/homepage/ui/hero-banner.tsx`
- Create: `src/modules/homepage/ui/homepage-shell.tsx`
- Create: `src/modules/homepage/index.ts`

### Existing files to modify

- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

### Tests to add

- Create: `src/modules/homepage/application/homepage-service.test.ts`
- Create: `src/modules/homepage/application/mock-data-provider.test.ts`
- Create: `src/modules/homepage/ui/homepage-shell.test.tsx`
- Create: `src/modules/homepage/ui/hero-banner.test.tsx`
- Create: `src/modules/homepage/ui/content-carousel.test.tsx`
- Create: `src/app/page.test.tsx`

---

## Task 1: Define Homepage Contracts and Defaults

**Files:**
- Create: `src/modules/homepage/domain/homepage-config.ts`
- Create: `src/modules/homepage/domain/content-types.ts`
- Create: `src/modules/homepage/domain/section-types.ts`
- Create: `src/modules/homepage/index.ts`

- [ ] **Step 1: Write the failing type-level contract check**

Create `src/modules/homepage/domain/homepage-config.ts` with a runtime default config that matches the product doc:

```ts
export type HomepageConfig = {
  showHeroBanner: boolean;
  showContinueWatching: boolean;
  showUpcomingReleases: boolean;
  showHotMovies: boolean;
  showHotTvShows: boolean;
  showNewAnime: boolean;
  showHotVariety: boolean;
  showHotShortDramas: boolean;
};

export const defaultHomepageConfig: HomepageConfig = {
  showHeroBanner: true,
  showContinueWatching: true,
  showUpcomingReleases: true,
  showHotMovies: true,
  showHotTvShows: true,
  showNewAnime: true,
  showHotVariety: true,
  showHotShortDramas: true,
};
```

Create `src/modules/homepage/domain/content-types.ts` with shared content models:

```ts
export type ContentType = "movie" | "tv" | "anime" | "variety" | "shortdrama";

export type ContentItem = {
  id: string;
  title: string;
  coverUrl: string;
  backdropUrl?: string;
  rating?: number;
  year?: number;
  type: ContentType;
  description?: string;
  genres?: string[];
};

export type HeroItem = {
  id: string;
  title: string;
  description: string;
  backdropUrl: string;
  rating: number;
  trailerUrl?: string;
  type: Exclude<ContentType, "shortdrama">;
};
```

Create `src/modules/homepage/domain/section-types.ts` with the homepage section keys and ordering:

```ts
export type HomepageSectionKey =
  | "heroBanner"
  | "continueWatching"
  | "upcomingReleases"
  | "hotMovies"
  | "hotTvShows"
  | "newAnime"
  | "hotVariety"
  | "hotShortDramas";

export const homepageSectionOrder: HomepageSectionKey[] = [
  "heroBanner",
  "continueWatching",
  "upcomingReleases",
  "hotMovies",
  "hotTvShows",
  "newAnime",
  "hotVariety",
  "hotShortDramas",
];
```

Export the public API from `src/modules/homepage/index.ts`.

- [ ] **Step 2: Run a type check to confirm the contracts compile**

Run: `npx tsc --noEmit`

Expected: Passes with no type errors.

- [ ] **Step 3: Implement the minimal contract exports**

Keep these files focused on type/value exports only. Do not add UI or data fetching logic here.

- [ ] **Step 4: Re-run the type check**

Run: `npx tsc --noEmit`

Expected: Passes.

- [ ] **Step 5: Commit**

```bash
git add src/modules/homepage/domain src/modules/homepage/index.ts
git commit -m "feat(homepage): define homepage data contracts"
```

## Task 2: Build Mock Data Provider and Homepage Service

**Files:**
- Create: `src/modules/homepage/application/mock-data-provider.ts`
- Create: `src/modules/homepage/application/homepage-service.ts`
- Create: `src/modules/homepage/application/mock-data-provider.test.ts`
- Create: `src/modules/homepage/application/homepage-service.test.ts`
- Modify: `src/modules/homepage/index.ts`

- [ ] **Step 1: Write the failing tests for data shaping**

Create `src/modules/homepage/application/mock-data-provider.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getMockHomepageData } from "./mock-data-provider";

describe("getMockHomepageData", () => {
  it("returns all homepage sections with mock items", () => {
    const data = getMockHomepageData();

    expect(data.heroBanner).toHaveLength(6);
    expect(data.hotMovies).toHaveLength(12);
    expect(data.hotShortDramas).toHaveLength(10);
  });
});
```

Create `src/modules/homepage/application/homepage-service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { defaultHomepageConfig } from "../domain/homepage-config";
import { getHomepageData } from "./homepage-service";

describe("getHomepageData", () => {
  it("filters disabled sections out of the result", async () => {
    const data = await getHomepageData({
      ...defaultHomepageConfig,
      showHotVariety: false,
      showNewAnime: false,
    });

    expect(data.sections.map((section) => section.key)).not.toContain("hotVariety");
    expect(data.sections.map((section) => section.key)).not.toContain("newAnime");
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail for missing implementations**

Run:

```bash
npm test -- src/modules/homepage/application/mock-data-provider.test.ts src/modules/homepage/application/homepage-service.test.ts
```

Expected: FAIL because the provider and service are not implemented yet.

- [ ] **Step 3: Implement the provider and service**

Implement `getMockHomepageData()` to return deterministic content arrays for all homepage sections.

Implement `getHomepageData(config = defaultHomepageConfig)` to:

- read the mock payload
- drop sections whose config flag is `false`
- exclude empty sections
- return the hero banner items separately from the rest of the section list

Suggested shape:

```ts
export type HomepageData = {
  heroBanner: HeroItem[];
  sections: Array<{
    key: HomepageSectionKey;
    title: string;
    moreLink?: string;
    items: ContentItem[];
  }>;
};
```

- [ ] **Step 4: Re-run the data tests**

Run:

```bash
npm test -- src/modules/homepage/application/mock-data-provider.test.ts src/modules/homepage/application/homepage-service.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/homepage/application src/modules/homepage/index.ts
git commit -m "feat(homepage): add mock homepage data service"
```

## Task 3: Build the Homepage UI Components

**Files:**
- Create: `src/modules/homepage/ui/loading-overlay.tsx`
- Create: `src/modules/homepage/ui/welcome-banner.tsx`
- Create: `src/modules/homepage/ui/content-card.tsx`
- Create: `src/modules/homepage/ui/content-carousel.tsx`
- Create: `src/modules/homepage/ui/hero-banner.tsx`
- Create: `src/modules/homepage/ui/homepage-shell.tsx`
- Create: `src/modules/homepage/ui/homepage-shell.test.tsx`
- Create: `src/modules/homepage/ui/hero-banner.test.tsx`
- Create: `src/modules/homepage/ui/content-carousel.test.tsx`

- [ ] **Step 1: Write rendering tests for the shell and banner components**

Use `react-dom/server` so the tests stay lightweight and do not require a browser runtime.

`src/modules/homepage/ui/homepage-shell.test.tsx`:

```ts
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HomepageShell } from "./homepage-shell";
import { getMockHomepageData } from "../application/mock-data-provider";

describe("HomepageShell", () => {
  it("renders the welcome banner and homepage sections", () => {
    const html = renderToStaticMarkup(<HomepageShell data={getMockHomepageData()} />);

    expect(html).toContain("MixTV");
    expect(html).toContain("欢迎");
  });
});
```

`src/modules/homepage/ui/hero-banner.test.tsx`:

```ts
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HeroBanner } from "./hero-banner";
import { getMockHomepageData } from "../application/mock-data-provider";

describe("HeroBanner", () => {
  it("renders the hero items and frosted info panel", () => {
    const html = renderToStaticMarkup(<HeroBanner items={getMockHomepageData().heroBanner} />);

    expect(html).toContain("backdrop-blur");
    expect(html).toContain(getMockHomepageData().heroBanner[0].title);
  });
});
```

`src/modules/homepage/ui/content-carousel.test.tsx`:

```ts
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContentCarousel } from "./content-carousel";
import { getMockHomepageData } from "../application/mock-data-provider";

describe("ContentCarousel", () => {
  it("renders a section title and content cards", () => {
    const section = getMockHomepageData().sections[0];
    const html = renderToStaticMarkup(<ContentCarousel title={section.title} items={section.items} />);

    expect(html).toContain(section.title);
    expect(html).toContain(section.items[0].title);
  });
});
```

- [ ] **Step 2: Run the rendering tests and confirm they fail**

Run:

```bash
npm test -- src/modules/homepage/ui/homepage-shell.test.tsx src/modules/homepage/ui/hero-banner.test.tsx src/modules/homepage/ui/content-carousel.test.tsx
```

Expected: FAIL because the components do not exist yet.

- [ ] **Step 3: Implement the UI components from the inside out**

Implementation order:

1. `ContentCard` with cover, title, rating, and hover scale effect.
2. `ContentCarousel` with horizontal scroll, section heading, and optional `moreLink`.
3. `WelcomeBanner` with greeting copy and frosted-glass surface.
4. `LoadingOverlay` with a centered cinematic loading state.
5. `HeroBanner` with a large backdrop, gradient mask, frosted detail panel, and dot indicators.
6. `HomepageShell` that composes the welcome banner, loading overlay, hero banner, and section carousels.

Keep the interaction logic minimal for this phase:

- Hero auto-rotation can use local state and `useEffect`.
- The shell should only accept already-shaped `HomepageData`.
- No Telegram modal or announcement modal in this phase.

- [ ] **Step 4: Re-run the rendering tests**

Run:

```bash
npm test -- src/modules/homepage/ui/homepage-shell.test.tsx src/modules/homepage/ui/hero-banner.test.tsx src/modules/homepage/ui/content-carousel.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/homepage/ui
git commit -m "feat(homepage): add homepage shell and sections"
```

## Task 4: Wire the App Router Entry and Global Presentation

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/modules/homepage/index.ts`

- [ ] **Step 1: Write a page-level integration test**

Add a test that renders the page server-side and checks the homepage shell is present.

```ts
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import HomePage from "@/app/page";

describe("HomePage", () => {
  it("renders the homepage content", async () => {
    const html = renderToStaticMarkup(await HomePage());
    expect(html).toContain("MixTV");
  });
});
```

- [ ] **Step 2: Run the page test and confirm it fails**

Run: `npm test -- src/app/page.test.tsx`

Expected: FAIL until the page composes the homepage module.

- [ ] **Step 3: Update the App Router files**

Change `src/app/page.tsx` to fetch from the homepage service and render the shell:

```tsx
import { HomepageShell, getHomepageData } from "@/modules/homepage";

export default async function HomePage() {
  const data = await getHomepageData();

  return <HomepageShell data={data} />;
}
```

Update `src/app/layout.tsx` to support the homepage visual language:

```tsx
import type { ReactNode } from "react";
import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

Update `src/app/globals.css` to set the dark homepage baseline and make the body render edge-to-edge:

```css
@import "tailwindcss";

:root {
  --background: #050816;
  --foreground: #f8fafc;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
  min-height: 100vh;
}
```

- [ ] **Step 4: Re-run the page test, lint, and build**

Run:

```bash
npm test -- src/app/page.test.tsx
npm run lint
npm run build
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx src/app/globals.css src/modules/homepage/index.ts src/app/page.test.tsx
git commit -m "feat(homepage): wire homepage module into app router"
```

## Task 5: Final Verification and Cleanup

**Files:**
- Review: all files touched in Tasks 1 to 4

- [ ] **Step 1: Run the focused homepage test suite**

Run:

```bash
npm test -- src/modules/homepage/application/mock-data-provider.test.ts src/modules/homepage/application/homepage-service.test.ts src/modules/homepage/ui/homepage-shell.test.tsx src/modules/homepage/ui/hero-banner.test.tsx src/modules/homepage/ui/content-carousel.test.tsx src/app/page.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run the repository checks one more time**

Run:

```bash
npm run lint
npm run build
```

Expected: PASS.

- [ ] **Step 3: Inspect the final homepage behavior manually**

Start the app with `npm run dev` and verify in the browser:

- the page loads with a dark cinematic background
- the welcome banner appears at the top
- the hero banner shows frosted-glass overlay content
- each configured section renders with mock cards
- the layout remains usable on a narrow viewport

- [ ] **Step 4: Commit any remaining cleanup**

If the verification step surfaces tiny fixes, batch them into a final commit:

```bash
git add .
git commit -m "fix(homepage): polish homepage shell and styles"
```

---

## Spec Coverage Check

This plan covers the approved design document as follows:

- Fixed UI areas: welcome banner, loading overlay, and homepage shell composition are in Task 3.
- Configurable modules: hero banner, continue watching, upcoming releases, hot movies, hot TV shows, new anime, hot variety, and hot short dramas are represented by the mock data and section renderer in Tasks 2 and 3.
- Dark Netflix-style presentation and frosted glass styling are enforced in Tasks 3 and 4.
- App Router integration and global styling are handled in Task 4.
- Verification is covered by focused tests, lint, build, and manual checks in Task 5.

## Notes for Execution

- Keep the implementation module-local. Do not move business logic into `src/app`.
- Do not add third-party carousel or animation dependencies for this phase.
- Keep the mock data deterministic so tests remain stable.
- Treat the announcement modal and Telegram modal as out of scope for this plan.
