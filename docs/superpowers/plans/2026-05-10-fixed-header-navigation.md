# Fixed Header Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fixed top layout with left/title, center navigation, right-side theme toggle and user menu, plus placeholder routes for each entry.

**Architecture:** Keep `src/app/layout.tsx` thin and use dedicated client components for the interactive shell (`SiteHeader`, `ThemeToggle`, `UserMenu`). Keep route placeholders in `src/app/*/page.tsx` and reuse a shared `PlaceholderPage` component for consistency.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS v4, Vitest

---

### Task 1: Root layout shell

**Files:**
- Modify: `src/app/layout.tsx`

- [x] **Step 1: Add the fixed header and content offset**

```tsx
import type { ReactNode } from "react";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <SiteHeader />
        <main className="pt-16">{children}</main>
      </body>
    </html>
  );
}
```

### Task 2: Interactive header shell

**Files:**
- Add: `src/components/site-header.tsx`
- Add: `src/components/theme-toggle.tsx`
- Add: `src/components/user-menu.tsx`

- [x] **Step 1: Build the three-part fixed header**
- [x] **Step 2: Add day/night toggle with browser-default behavior**
- [x] **Step 3: Add user dropdown with admin-only menu entry**

### Task 3: Shared placeholder page

**Files:**
- Add: `src/components/placeholder-page.tsx`

- [x] **Step 1: Add a reusable placeholder page component**

### Task 4: Placeholder routes

**Files:**
- Add: `src/app/search/page.tsx`
- Add: `src/app/sources/page.tsx`
- Add: `src/app/movies/page.tsx`
- Add: `src/app/series/page.tsx`
- Add: `src/app/anime/page.tsx`
- Add: `src/app/variety/page.tsx`
- Add: `src/app/settings/page.tsx`
- Add: `src/app/updates/page.tsx`
- Add: `src/app/continue-watching/page.tsx`
- Add: `src/app/favorites/page.tsx`
- Add: `src/app/admin/page.tsx`
- Add: `src/app/stats/page.tsx`
- Add: `src/app/release-schedule/page.tsx`
- Add: `src/app/version/page.tsx`
- Add: `src/app/logout/page.tsx`

- [x] **Step 1: Add route stubs for each header/menu target**

### Task 5: Styling and verification

**Files:**
- Modify: `src/app/globals.css`
- Add: `src/components/site-header.test.tsx`

- [x] **Step 1: Add theme-aware CSS variables**
- [x] **Step 2: Add a static render test for the header**
