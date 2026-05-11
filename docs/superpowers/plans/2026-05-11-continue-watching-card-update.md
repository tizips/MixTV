# Continue Watching Card Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the homepage continue-watching card to show episode progress, unread episode count, source text, and real action buttons without changing the other homepage card variants.

**Architecture:** Keep the existing shared `ContentCard` component, but add a `variant` flag so only the continue-watching section renders the richer layout. Extend the homepage mock content with continue-watching-specific metadata, and thread the section key through the carousel so the homepage shell can select the right card treatment.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Vitest.

---

### Task 1: Extend continue-watching content data

**Files:**
- Modify: `src/modules/homepage/domain/content-types.ts`
- Modify: `src/modules/homepage/application/mock-data-provider.ts`
- Modify: `src/modules/homepage/application/homepage-service.ts`

- [ ] **Step 1: Add continue-watching metadata to the shared content type**

```ts
export type ContinueWatchingInfo = {
  currentEpisode: number;
  latestEpisode: number;
  sourceName: string;
};

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
  continueWatching?: ContinueWatchingInfo;
};
```

- [ ] **Step 2: Populate continue-watching entries in mock data**

```ts
continueWatching: [
  {
    id: "cw-1",
    title: "繁城之下",
    coverUrl: "https://via.placeholder.com/300x450/1a1a2e/ffffff?text=繁城之下",
    rating: 8.1,
    year: 2024,
    type: "tv",
    continueWatching: {
      currentEpisode: 12,
      latestEpisode: 16,
      sourceName: "腾讯视频",
    },
  },
]
```

- [ ] **Step 3: Narrow homepage section rendering to the continue-watching variant only**

```ts
export type HomepageData = {
  heroBanner: HeroItem[];
  showWelcomeBanner: boolean;
  sections: Array<{
    key: HomepageSectionKey;
    title: string;
    moreLink?: string;
    items: ContentItem[];
  }>;
};
```

### Task 2: Add the continue-watching card variant

**Files:**
- Modify: `src/modules/homepage/ui/content-card.tsx`
- Modify: `src/modules/homepage/ui/content-carousel.tsx`
- Modify: `src/modules/homepage/ui/homepage-shell.tsx`

- [ ] **Step 1: Add a `variant` prop and action callbacks to `ContentCard`**

```ts
type ContentCardProps = {
  item: ContentItem;
  variant?: "default" | "continueWatching";
  onClick?: () => void;
  onFavorite?: () => void;
  onDelete?: () => void;
};
```

- [ ] **Step 2: Render continue-watching badges, source text, and action buttons when the variant is active**

```tsx
const progress = item.continueWatching;
const extraEpisodes = progress ? progress.latestEpisode - progress.currentEpisode : 0;
```

- [ ] **Step 3: Pass the section key through the carousel so only the continue-watching section opts into the new variant**

```ts
type ContentCarouselProps = {
  title: string;
  items: ContentItem[];
  moreLink?: string;
  variant?: "default" | "continueWatching";
};
```

- [ ] **Step 4: Thread the variant from the homepage shell using `section.key`**

```tsx
<ContentCarousel
  key={section.key}
  title={section.title}
  items={section.items}
  moreLink={section.moreLink}
  variant={section.key === "continueWatching" ? "continueWatching" : "default"}
/>
```

### Task 3: Update tests and verify the new behavior

**Files:**
- Modify: `src/modules/homepage/ui/content-card.test.tsx`
- Modify: `src/modules/homepage/ui/content-carousel.test.tsx`

- [ ] **Step 1: Add a continue-watching rendering assertion for the card**

```ts
const item = data.sections.find((section) => section.key === "continueWatching")?.items[0];
```

- [ ] **Step 2: Assert the rendered HTML contains the progress pills, source name, and action buttons**

```ts
expect(html).toContain("12/16");
expect(html).toContain("+4");
expect(html).toContain("腾讯视频");
expect(html).toContain("收藏");
expect(html).toContain("删除");
```

- [ ] **Step 3: Run the focused Vitest files**

Run: `npm test -- src/modules/homepage/ui/content-card.test.tsx src/modules/homepage/ui/content-carousel.test.tsx`

Expected: both tests pass.

- [ ] **Step 4: Run the homepage test slice or full test suite if the focused slice passes**

Run: `npm test`

Expected: all tests pass without regressions.
