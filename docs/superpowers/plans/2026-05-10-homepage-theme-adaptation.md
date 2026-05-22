# Homepage Theme Adaptation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing homepage shell and homepage UI render cleanly in both light and dark themes, without changing any non-homepage routes.

**Architecture:** Add homepage-scoped theme tokens on top of the existing root theme variables, then update the homepage shell and its child UI components to consume those tokens instead of hard-coded dark colors. Keep the route structure, data flow, and homepage module boundaries unchanged so the work stays isolated to the homepage feature area.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, CSS custom properties, Vitest

---

### Task 1: Add homepage theme tokens

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add failing theme-token expectations to the homepage tests**

Create or update a test that asserts the homepage shell and major UI blocks no longer rely on hard-coded dark-only class names such as `bg-gray-900`, `bg-black/30`, or `text-gray-400`.

```tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HomepageShell } from "./homepage-shell";
import { getHomepageData } from "../application/homepage-service";

describe("HomepageShell theme adaptation", () => {
  it("renders homepage theme-aware surface tokens", async () => {
    const data = await getHomepageData();
    const html = renderToStaticMarkup(<HomepageShell data={data} />);

    expect(html).not.toContain("bg-gray-900");
    expect(html).not.toContain("bg-black/30");
    expect(html).not.toContain("text-gray-400");
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -- src/modules/homepage/ui/homepage-shell.test.tsx`

Expected: FAIL because the homepage still uses hard-coded dark-only classes.

- [ ] **Step 3: Add homepage-scoped semantic tokens**

Extend `src/app/globals.css` with homepage-specific variables that map to the active theme, for example:

```css
:root {
  --homepage-bg: #050816;
  --homepage-surface: rgba(15, 23, 42, 0.72);
  --homepage-surface-strong: rgba(15, 23, 42, 0.92);
  --homepage-border: rgba(255, 255, 255, 0.10);
  --homepage-text: #f8fafc;
  --homepage-muted: rgba(226, 232, 240, 0.72);
  --homepage-accent: #67e8f9;
}

:root[data-theme="light"] {
  --homepage-bg: #f8fafc;
  --homepage-surface: rgba(255, 255, 255, 0.78);
  --homepage-surface-strong: rgba(255, 255, 255, 0.92);
  --homepage-border: rgba(15, 23, 42, 0.10);
  --homepage-text: #0f172a;
  --homepage-muted: rgba(71, 85, 105, 0.80);
  --homepage-accent: #0891b2;
}

:root[data-theme="dark"] {
  --homepage-bg: #050816;
  --homepage-surface: rgba(15, 23, 42, 0.72);
  --homepage-surface-strong: rgba(15, 23, 42, 0.92);
  --homepage-border: rgba(255, 255, 255, 0.10);
  --homepage-text: #f8fafc;
  --homepage-muted: rgba(226, 232, 240, 0.72);
  --homepage-accent: #67e8f9;
}
```

The exact color values can be adjusted, but the variables must exist and represent homepage-level surface, text, muted text, border, and accent concepts.

- [ ] **Step 4: Run the test and confirm it passes after component updates**

Run: `npm test -- src/modules/homepage/ui/homepage-shell.test.tsx`

Expected: PASS after the homepage components are updated in later tasks.

---

### Task 2: Theme the homepage shell and welcome banner

**Files:**
- Modify: `src/modules/homepage/ui/homepage-shell.tsx`
- Modify: `src/modules/homepage/ui/welcome-banner.tsx`
- Test: `src/modules/homepage/ui/homepage-shell.test.tsx`

- [ ] **Step 1: Update the test to check the shell still renders, but no longer depends on hard-coded dark-only classes**

```tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HomepageShell } from "./homepage-shell";
import { getHomepageData } from "../application/homepage-service";

describe("HomepageShell", () => {
  it("renders the welcome banner and homepage sections with theme tokens", async () => {
    const data = await getHomepageData();
    const html = renderToStaticMarkup(<HomepageShell data={data} />);

    expect(html).toContain("MixTV");
    expect(html).toContain("欢迎");
    expect(html).not.toContain("bg-gray-900");
    expect(html).not.toContain("bg-black/30");
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -- src/modules/homepage/ui/homepage-shell.test.tsx`

Expected: FAIL because the shell and welcome banner still use fixed dark classes.

- [ ] **Step 3: Replace shell and welcome banner hard-coded colors with homepage tokens**

Use the homepage theme variables in the two components so they control the route canvas and the intro block:

```tsx
// src/modules/homepage/ui/homepage-shell.tsx
export function HomepageShell({ data, userName }: HomepageShellProps) {
  const [isLoading] = useState(false);

  return (
    <div className="min-h-screen bg-(--homepage-bg) px-4 py-4 text-(--homepage-text) md:px-6 md:py-6 lg:px-12 lg:py-12">
      <LoadingOverlay isLoading={isLoading} />
      <WelcomeBanner userName={userName} />
      {data.heroBanner.length > 0 && <HeroBanner items={data.heroBanner} />}
      <div className="space-y-8">
        {data.sections.map((section) => (
          <ContentCarousel
            key={section.key}
            title={section.title}
            items={section.items}
            moreLink={section.moreLink}
          />
        ))}
      </div>
    </div>
  );
}

// src/modules/homepage/ui/welcome-banner.tsx
export function WelcomeBanner({ userName }: WelcomeBannerProps) {
  const greeting = userName ? `欢迎回来，${userName}` : "欢迎来到 MixTV";

  return (
    <div className="mb-6 rounded-lg border border-(--homepage-border) bg-(--homepage-surface) p-6 backdrop-blur-md">
      <h1 className="mb-2 text-3xl font-bold text-(--homepage-text)">{greeting}</h1>
      <p className="text-(--homepage-muted)">探索精彩影视内容</p>
    </div>
  );
}
```

- [ ] **Step 4: Run the homepage shell test and confirm it passes**

Run: `npm test -- src/modules/homepage/ui/homepage-shell.test.tsx`

Expected: PASS.

---

### Task 3: Theme the hero banner and carousel card surfaces

**Files:**
- Modify: `src/modules/homepage/ui/hero-banner.tsx`
- Modify: `src/modules/homepage/ui/content-carousel.tsx`
- Modify: `src/modules/homepage/ui/content-card.tsx`
- Test: `src/modules/homepage/ui/hero-banner.test.tsx`
- Test: `src/modules/homepage/ui/content-carousel.test.tsx`

- [ ] **Step 1: Update the component tests to expect theme-aware classes instead of fixed dark-only classes**

```tsx
// hero-banner.test.tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HeroBanner } from "./hero-banner";
import { getHomepageData } from "../application/homepage-service";

describe("HeroBanner", () => {
  it("renders the hero items and theme-aware info panel", async () => {
    const data = await getHomepageData();
    const html = renderToStaticMarkup(<HeroBanner items={data.heroBanner} />);

    expect(html).toContain(data.heroBanner[0].title);
    expect(html).not.toContain("bg-black/30");
    expect(html).not.toContain("text-gray-300");
  });
});

// content-carousel.test.tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContentCarousel } from "./content-carousel";
import { getHomepageData } from "../application/homepage-service";

describe("ContentCarousel", () => {
  it("renders a section title and theme-aware content cards", async () => {
    const data = await getHomepageData();
    const section = data.sections[0];
    const html = renderToStaticMarkup(
      <ContentCarousel title={section.title} items={section.items} />,
    );

    expect(html).toContain(section.title);
    expect(html).toContain(section.items[0].title);
    expect(html).not.toContain("text-white");
    expect(html).not.toContain("text-gray-400");
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail before implementation**

Run:

```bash
npm test -- src/modules/homepage/ui/hero-banner.test.tsx src/modules/homepage/ui/content-carousel.test.tsx
```

Expected: FAIL because the hero and carousel still use hard-coded dark colors.

- [ ] **Step 3: Replace hero, carousel, and card styles with homepage tokens**

Update the components so their overlays, titles, muted text, and card frame/badges consume `--homepage-*` tokens instead of fixed white/gray values. Keep the banner layout, image handling, and carousel behavior unchanged.

```tsx
// hero-banner.tsx
<div className="relative mb-8 h-[70vh] w-full overflow-hidden rounded-lg border border-(--homepage-border) bg-(--homepage-surface-strong)">
  ...
  <div className="absolute inset-0 bg-gradient-to-t from-(--homepage-bg) via-(--homepage-bg)/60 to-transparent" />
  ...
  <div className="rounded-lg border border-(--homepage-border) bg-(--homepage-surface) p-6 backdrop-blur-md">
    <h2 className="mb-4 text-4xl font-bold text-(--homepage-text) md:text-5xl">...
    <span className="text-(--homepage-accent)">⭐ ...</span>
    <span className="text-(--homepage-muted)">...</span>
    <p className="text-(--homepage-muted)">...</p>
  </div>
</div>

// content-carousel.tsx
<h2 className="text-2xl font-bold text-(--homepage-text)">{title}</h2>
<Link className="text-sm text-(--homepage-muted) transition-colors hover:text-(--homepage-text)">...</Link>

// content-card.tsx
<div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-(--homepage-border) bg-(--homepage-surface-strong) transition-transform duration-300 hover:scale-105 hover:shadow-2xl">
  ...
  <div className="absolute top-2 right-2 rounded bg-(--homepage-surface-strong)/80 px-2 py-1 text-sm font-semibold text-(--homepage-accent) backdrop-blur-sm">
    ...
  </div>
</div>
<h3 className="mt-2 line-clamp-2 text-sm font-medium text-(--homepage-text)">...
<p className="text-xs text-(--homepage-muted)">...
```

- [ ] **Step 4: Run the hero and carousel tests and confirm they pass**

Run:

```bash
npm test -- src/modules/homepage/ui/hero-banner.test.tsx src/modules/homepage/ui/content-carousel.test.tsx
```

Expected: PASS.

---

### Task 4: Theme the loading overlay and verify the homepage end to end

**Files:**
- Modify: `src/modules/homepage/ui/loading-overlay.tsx`
- Test: `src/modules/homepage/ui/homepage-shell.test.tsx`
- Test: `src/modules/homepage/ui/hero-banner.test.tsx`
- Test: `src/modules/homepage/ui/content-carousel.test.tsx`

- [ ] **Step 1: Add or update a homepage shell assertion for the loading overlay theme tokens**

Use the existing homepage shell test files to ensure the loading overlay no longer relies on a hard-coded black backdrop.

```tsx
expect(html).not.toContain("bg-black/80");
expect(html).not.toContain("text-white text-lg font-medium");
```

- [ ] **Step 2: Run the homepage shell test and confirm it fails before the overlay change**

Run: `npm test -- src/modules/homepage/ui/homepage-shell.test.tsx`

Expected: FAIL if the overlay still uses hard-coded dark-only classes.

- [ ] **Step 3: Update the loading overlay to use homepage tokens**

```tsx
export function LoadingOverlay({ isLoading }: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--homepage-bg)/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 rounded-lg border border-(--homepage-border) bg-(--homepage-surface) p-6">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-(--homepage-border) border-t-(--homepage-text)" />
        <p className="text-lg font-medium text-(--homepage-text)">加载中...</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the homepage tests and repository lint**

Run:

```bash
npm test -- src/modules/homepage/ui/homepage-shell.test.tsx src/modules/homepage/ui/hero-banner.test.tsx src/modules/homepage/ui/content-carousel.test.tsx
npm run lint
```

Expected: all tests pass and lint passes.

- [ ] **Step 5: Manual homepage check**

Run the app with `npm run dev` and verify only the homepage route is visually updated:

- dark mode keeps the cinematic look
- light mode makes the homepage readable and clean
- the homepage shell, hero, cards, and loading overlay all remain legible
- no other route was changed
