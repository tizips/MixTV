# Theme Menu Toggle Design

> **Goal:** Let the site header theme control support `system`, `light`, and `dark` modes with a menu-based selector, while keeping the root layout in sync with the active preference.

**Architecture:** Keep theme state local to the existing client-only header control and persist it in `localStorage`. The control updates the root `<html>` element via `data-theme` and `color-scheme`, so the rest of the app continues to rely on CSS variables defined in `globals.css` without extra page-level wiring.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, browser `localStorage`, `prefers-color-scheme`

---

### Requirements

- Preserve `system` as a first-class theme mode.
- Replace the current one-button theme cycler with a menu that lets the user choose `system`, `light`, or `dark` directly.
- Keep the header control in `src/components/theme-toggle.tsx` and keep it wired through `src/components/site-header.tsx`.
- Continue using the root layout in `src/app/layout.tsx` as the single place that mounts the header.
- Keep the existing CSS variable approach in `src/app/globals.css` so the app theme still flows through `--background`, `--foreground`, and `--surface`.
- Avoid introducing a global state library or extra theme provider unless the current implementation cannot support the behavior.

### Proposed File Changes

- Modify: `src/components/theme-toggle.tsx`
- Modify: `src/components/site-header.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Add or update tests near the theme control if needed, most likely under `src/components/` or `tests/` depending on the existing test pattern.

### Implementation Notes

#### 1. Theme control behavior

The existing `ThemeToggle` already stores the preference key `mixtv-theme` and applies the chosen theme to `document.documentElement`. The new version should keep that storage key and keep the same three values: `system`, `light`, and `dark`.

The visible control should become a menu trigger. The trigger should expose the current mode in its label, and the menu should offer exactly three actions:

- `跟随系统`
- `日间模式`
- `夜间模式`

Selecting one of these actions should update the stored preference immediately and update the root element so the whole page repaints using the new theme.

#### 2. Theme application rules

- If the stored value is `light`, set `document.documentElement.dataset.theme = "light"` and `document.documentElement.style.colorScheme = "light"`.
- If the stored value is `dark`, set `document.documentElement.dataset.theme = "dark"` and `document.documentElement.style.colorScheme = "dark"`.
- If the stored value is `system`, remove `data-theme` and clear the inline `colorScheme` value so the browser uses its system preference.
- On initial mount, read `localStorage` and initialize the control from that value when it is valid.
- If `localStorage` is empty or contains an unexpected value, default to `system`.

#### 3. Header and layout integration

`src/components/site-header.tsx` should continue to render the theme control in the right-hand utility area next to `UserMenu`. The root layout should remain minimal and should not gain any theme-specific logic beyond continuing to mount `SiteHeader` and using `suppressHydrationWarning` on `<html>`.

#### 4. CSS variables

`src/app/globals.css` should keep the same variable-based theme setup. The current light and dark overrides already cover explicit modes; `system` should continue to rely on the browser `prefers-color-scheme` behavior when no `data-theme` attribute is present.

### Verification

- Confirm the header still renders on every page through `src/app/layout.tsx`.
- Confirm the theme control shows the active mode and lets the user choose between `system`, `light`, and `dark` directly.
- Confirm the selected mode persists across reloads.
- Confirm switching back to `system` removes the explicit root theme attribute and follows the browser preference again.
- Run the repository lint and relevant tests after implementation.
