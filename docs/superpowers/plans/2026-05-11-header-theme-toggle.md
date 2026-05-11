# Header Theme Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact `auto -> light -> dark` theme toggle button immediately to the left of the header user menu.

**Architecture:** Implement the theme behavior in a focused client component so `SiteHeader` only composes header actions. The component owns localStorage reads/writes and `document.documentElement` mutation, while global CSS continues to provide both automatic and explicit theme styling.

**Tech Stack:** Next.js App Router, React 19 client components, HeroUI `Button`, Bootstrap Icons, Vitest, React DOM server rendering tests.

---

## File Structure

- Create `src/components/theme-toggle.tsx`: focused client component that cycles theme mode, applies `data-theme`, persists to localStorage, and renders the circular icon button.
- Create `src/components/theme-toggle.test.tsx`: focused tests for initial render, cycling behavior, localStorage persistence, and root `data-theme` mutation.
- Modify `src/components/site-header.tsx`: import `ThemeToggle` and render it before `UserMenu`.
- Modify `src/components/site-header.test.tsx`: assert the toggle appears before the user menu and keep legacy shell absence checks.

### Task 1: Theme Toggle Component

**Files:**
- Create: `src/components/theme-toggle.tsx`
- Test: `src/components/theme-toggle.test.tsx`

- [ ] **Step 1: Write the failing component tests**

Create `src/components/theme-toggle.test.tsx` with:

```tsx
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeToggle } from "./theme-toggle";

function renderClient() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  act(() => {
    root.render(<ThemeToggle />);
  });

  const button = host.querySelector("button");
  if (!button) {
    throw new Error("Theme toggle button was not rendered");
  }

  return { button, host, root };
}

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.body.innerHTML = "";
});

describe("ThemeToggle", () => {
  it("renders the automatic theme icon by default", () => {
    const html = renderToStaticMarkup(<ThemeToggle />);

    expect(html).toContain("切换主题，当前自动");
    expect(html).toContain("bi-circle-half");
  });

  it("cycles auto to light to dark to auto", () => {
    const { button, root } = renderClient();

    act(() => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("mixtv-theme-mode")).toBe("light");

    act(() => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("mixtv-theme-mode")).toBe("dark");

    act(() => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(localStorage.getItem("mixtv-theme-mode")).toBe("auto");

    act(() => {
      root.unmount();
    });
  });

  it("initializes from a persisted dark preference", () => {
    localStorage.setItem("mixtv-theme-mode", "dark");

    const { button, root } = renderClient();

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(button.getAttribute("aria-label")).toContain("当前深色");
    expect(button.innerHTML).toContain("bi-moon-stars-fill");

    act(() => {
      root.unmount();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/theme-toggle.test.tsx`

Expected: FAIL because `src/components/theme-toggle.tsx` does not exist.

- [ ] **Step 3: Implement the component**

Create `src/components/theme-toggle.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/react";

type ThemeMode = "auto" | "light" | "dark";

const storageKey = "mixtv-theme-mode";

const themeModes: ThemeMode[] = ["auto", "light", "dark"];

const modeConfig: Record<ThemeMode, { icon: string; label: string }> = {
  auto: { icon: "bi-circle-half", label: "自动" },
  light: { icon: "bi-sun-fill", label: "浅色" },
  dark: { icon: "bi-moon-stars-fill", label: "深色" },
};

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "auto" || value === "light" || value === "dark";
}

function applyThemeMode(mode: ThemeMode) {
  if (mode === "auto") {
    document.documentElement.removeAttribute("data-theme");
    return;
  }

  document.documentElement.dataset.theme = mode;
}

function getNextMode(mode: ThemeMode): ThemeMode {
  const currentIndex = themeModes.indexOf(mode);
  return themeModes[(currentIndex + 1) % themeModes.length];
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("auto");
  const config = modeConfig[mode];

  useEffect(() => {
    const storedMode = localStorage.getItem(storageKey);
    const initialMode = isThemeMode(storedMode) ? storedMode : "auto";

    setMode(initialMode);
    applyThemeMode(initialMode);
  }, []);

  function handlePress() {
    const nextMode = getNextMode(mode);

    setMode(nextMode);
    applyThemeMode(nextMode);
    localStorage.setItem(storageKey, nextMode);
  }

  return (
    <Button
      aria-label={`切换主题，当前${config.label}`}
      className="h-10 w-10 rounded-full p-0"
      isIconOnly
      onPress={handlePress}
      variant="light"
    >
      <i aria-hidden="true" className={`bi ${config.icon} text-base`} />
    </Button>
  );
}
```

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/components/theme-toggle.test.tsx`

Expected: PASS.

### Task 2: Header Integration

**Files:**
- Modify: `src/components/site-header.tsx`
- Modify: `src/components/site-header.test.tsx`

- [ ] **Step 1: Write the failing header assertions**

Update `src/components/site-header.test.tsx` first test to include:

```tsx
    expect(html).toContain("切换主题，当前自动");
    expect(html.indexOf("切换主题，当前自动")).toBeLessThan(html.indexOf("打开个人中心"));
```

Keep the legacy checks, including:

```tsx
    expect(html).not.toContain("bg-white/70");
    expect(html).not.toContain("bi-person-circle");
    expect(html).not.toContain("border-b-2");
```

Remove or replace the old assertion that expects the theme toggle label to be absent:

```tsx
    expect(html).not.toContain("切换主题，当前");
```

- [ ] **Step 2: Run header test to verify it fails**

Run: `npm test -- src/components/site-header.test.tsx`

Expected: FAIL because `SiteHeader` does not render `ThemeToggle` yet.

- [ ] **Step 3: Integrate the toggle**

Modify `src/components/site-header.tsx` imports:

```tsx
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
```

Modify the right-side actions:

```tsx
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <ThemeToggle />
          <UserMenu userName={userName} isAdmin={isAdmin} />
        </div>
```

- [ ] **Step 4: Run focused header tests**

Run: `npm test -- src/components/site-header.test.tsx`

Expected: PASS.

### Task 3: Verification

**Files:**
- Verify all touched files.

- [ ] **Step 1: Run all component tests touched by this change**

Run: `npm test -- src/components/theme-toggle.test.tsx src/components/site-header.test.tsx src/components/user-menu.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run: `npm test`

Expected: PASS.

## Self-Review

- Spec coverage: The plan covers the compact button, placement before `UserMenu`, three-state cycling, `data-theme` behavior, localStorage persistence, Bootstrap Icons, and tests.
- Placeholder scan: No TBD/TODO placeholders remain.
- Type consistency: `ThemeMode`, `storageKey`, and icon names are consistent across tests and implementation.

## Git Note

Do not commit during execution unless the user explicitly asks for a git commit.
