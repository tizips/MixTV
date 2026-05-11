# Theme Menu Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current theme cycler with a menu-based selector that supports `system`, `light`, and `dark`, and keep the root layout/theme CSS in sync with the active choice.

**Architecture:** Split the theme work into two small pieces: a pure state/DOM-sync helper module and a client-only `ThemeToggle` component that renders a native `<select>`. This keeps the behavior testable in Node, avoids a new global state layer, and preserves the existing root-layout-driven header shell.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, Vitest, browser `localStorage`

---

### Task 1: Add theme preference helpers

**Files:**
- Create: `src/components/theme-toggle-state.ts`
- Add: `src/components/theme-toggle-state.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  getThemePresentation,
  normalizeThemePreference,
  syncThemeToRoot,
} from "./theme-toggle-state";

describe("theme-toggle-state", () => {
  it("normalizes stored values to a valid theme preference", () => {
    expect(normalizeThemePreference(null)).toBe("system");
    expect(normalizeThemePreference("light")).toBe("light");
    expect(normalizeThemePreference("dark")).toBe("dark");
    expect(normalizeThemePreference("system")).toBe("system");
    expect(normalizeThemePreference("unexpected")).toBe("system");
  });

  it("maps each preference to the right label and icon", () => {
    expect(getThemePresentation("system")).toEqual({ label: "跟随系统", icon: "◐" });
    expect(getThemePresentation("light")).toEqual({ label: "日间模式", icon: "☀️" });
    expect(getThemePresentation("dark")).toEqual({ label: "夜间模式", icon: "🌙" });
  });

  it("syncs explicit and system modes to the root element", () => {
    const root = {
      dataset: {} as { theme?: string },
      style: { colorScheme: "" },
    };

    syncThemeToRoot(root, "dark");
    expect(root.dataset.theme).toBe("dark");
    expect(root.style.colorScheme).toBe("dark");

    syncThemeToRoot(root, "system");
    expect(root.dataset.theme).toBeUndefined();
    expect(root.style.colorScheme).toBe("");
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -- src/components/theme-toggle-state.test.ts`

Expected: FAIL because `theme-toggle-state.ts` does not exist yet.

- [ ] **Step 3: Implement the helper module**

```ts
export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "mixtv-theme";

type ThemeRoot = {
  dataset: { theme?: string };
  style: { colorScheme: string };
};

const THEME_PRESENTATION: Record<ThemePreference, { label: string; icon: string }> = {
  system: { label: "跟随系统", icon: "◐" },
  light: { label: "日间模式", icon: "☀️" },
  dark: { label: "夜间模式", icon: "🌙" },
};

export function normalizeThemePreference(value: string | null): ThemePreference {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }

  return "system";
}

export function getThemePresentation(preference: ThemePreference) {
  return THEME_PRESENTATION[preference];
}

export function syncThemeToRoot(root: ThemeRoot, preference: ThemePreference) {
  if (preference === "system") {
    delete root.dataset.theme;
    root.style.colorScheme = "";
    return;
  }

  root.dataset.theme = preference;
  root.style.colorScheme = preference;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test -- src/components/theme-toggle-state.test.ts`

Expected: PASS.

---

### Task 2: Convert the header theme control into a selector

**Files:**
- Modify: `src/components/theme-toggle.tsx`

- [ ] **Step 1: Write the failing component expectation**

Update the existing header test so it expects a selector-based control instead of the old cycler label.

```tsx
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
  it("renders the fixed header navigation and theme selector", () => {
    const html = renderToStaticMarkup(<SiteHeader />);

    expect(html).toContain("MixTV");
    expect(html).toContain("首页");
    expect(html).toContain("搜索");
    expect(html).toContain("源浏览器");
    expect(html).toContain('aria-label="切换主题，当前跟随系统"');
    expect(html).toContain('value="system"');
    expect(html).toContain('value="light"');
    expect(html).toContain('value="dark"');
    expect(html).toContain("aria-label=\"打开个人中心\"");
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -- src/components/site-header.test.tsx`

Expected: FAIL because the component still exposes the old button-based label and no selector.

- [ ] **Step 3: Implement the selector-based control**

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  THEME_STORAGE_KEY,
  getThemePresentation,
  normalizeThemePreference,
  syncThemeToRoot,
  type ThemePreference,
} from "./theme-toggle-state";

export function ThemeToggle() {
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");

  useEffect(() => {
    setThemePreference(normalizeThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY)));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, themePreference);
    syncThemeToRoot(document.documentElement, themePreference);
  }, [themePreference]);

  const presentation = getThemePresentation(themePreference);

  return (
    <label className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-sm font-medium text-slate-100 transition hover:border-cyan-400/40 hover:bg-white/10">
      <span aria-hidden="true" className="text-base leading-none">
        {presentation.icon}
      </span>
      <span className="sr-only">主题</span>
      <select
        value={themePreference}
        onChange={(event) => setThemePreference(normalizeThemePreference(event.target.value))}
        aria-label={`切换主题，当前${presentation.label}`}
        className="cursor-pointer appearance-none border-0 bg-transparent pr-5 text-sm font-medium text-inherit outline-none"
      >
        <option value="system">跟随系统</option>
        <option value="light">日间模式</option>
        <option value="dark">夜间模式</option>
      </select>
    </label>
  );
}
```

- [ ] **Step 4: Run the component test and confirm it passes**

Run: `npm test -- src/components/site-header.test.tsx`

Expected: PASS, and the header still renders the navigation plus the user menu.

---

### Task 3: Verify layout integration and final behavior

**Files:**
- Verify: `src/app/layout.tsx`
- Verify: `src/app/globals.css`
- Verify: `src/components/site-header.test.tsx`
- Verify: `src/components/theme-toggle-state.test.ts`

- [ ] **Step 1: Confirm the root layout stays thin**

Keep the current root layout shape intact:

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

Only touch this file if the selector implementation reveals a real spacing or hydration issue.

- [ ] **Step 2: Confirm the CSS variable theme rules still work**

Keep the existing `globals.css` theme contract in place:

```css
:root {
  color-scheme: dark;
  --background: #050816;
  --foreground: #f8fafc;
  --surface: rgba(15, 23, 42, 0.92);
}

@media (prefers-color-scheme: light) {
  :root {
    color-scheme: light;
    --background: #f8fafc;
    --foreground: #0f172a;
    --surface: rgba(255, 255, 255, 0.92);
  }
}

:root[data-theme="dark"] {
  color-scheme: dark;
  --background: #050816;
  --foreground: #f8fafc;
  --surface: rgba(15, 23, 42, 0.92);
}

:root[data-theme="light"] {
  color-scheme: light;
  --background: #f8fafc;
  --foreground: #0f172a;
  --surface: rgba(255, 255, 255, 0.92);
}
```

Do not add a new theme provider or duplicate theme state in CSS.

- [ ] **Step 3: Run the full relevant checks**

Run:

```bash
npm test -- src/components/theme-toggle-state.test.ts src/components/site-header.test.tsx
npm run lint
```

Expected: both commands pass.

- [ ] **Step 4: Manually verify the user-visible behavior in the browser**

Check these behaviors after starting the app with `npm run dev`:

- Open the header theme selector and confirm the three choices are visible.
- Switch to `日间模式` and confirm the page background and text colors update immediately.
- Switch to `夜间模式` and confirm the dark variables return.
- Switch back to `跟随系统`, then change the OS/browser theme and confirm the page follows it again after reload.
- Refresh the page after each selection and confirm the stored preference survives.
