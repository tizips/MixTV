# Homepage Theme Adaptation Design

> **Goal:** Adapt the existing homepage shell and homepage modules to light and dark themes, without expanding theme work to any other route.

**Architecture:** Keep the global theme switcher and root theme state as-is, but make the homepage consume theme-aware semantic variables instead of hard-coded dark values. The homepage shell provides the overall page canvas, while the welcome banner, hero banner, carousel, card, and loading overlay each use a small set of shared surface/text/border tokens so light and dark modes look coherent without affecting other routes.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, CSS custom properties, current homepage module components

---

### Scope

- In scope: the homepage route and the current homepage shell/components under `src/modules/homepage/ui`.
- In scope: homepage-specific CSS variables or theme tokens needed to restyle those components.
- Out of scope: any other route under `src/app/*` besides the homepage, and any general app-wide redesign beyond the homepage shell.

### Requirements

- Replace hard-coded homepage dark styling with theme-aware classes or CSS variables.
- Make the homepage background, surface blocks, borders, heading text, secondary text, and loading overlay readable in both light and dark themes.
- Keep the homepage layout and content structure unchanged.
- Do not introduce a new theme provider or a separate homepage theme state.
- Do not change other routes or shared components outside the homepage module unless a homepage-only dependency requires it.

### Proposed File Changes

- Modify: `src/app/globals.css`
- Modify: `src/modules/homepage/ui/homepage-shell.tsx`
- Modify: `src/modules/homepage/ui/welcome-banner.tsx`
- Modify: `src/modules/homepage/ui/hero-banner.tsx`
- Modify: `src/modules/homepage/ui/content-carousel.tsx`
- Modify: `src/modules/homepage/ui/content-card.tsx`
- Modify: `src/modules/homepage/ui/loading-overlay.tsx`
- Add or update tests near the homepage UI components if needed, most likely alongside the existing homepage UI test files.

### Implementation Notes

#### 1. Homepage semantic theme tokens

Extend `src/app/globals.css` with homepage-scoped semantic tokens that sit on top of the existing root theme variables. The homepage tokens should express concepts rather than raw colors, for example:

- `--homepage-bg`
- `--homepage-surface`
- `--homepage-surface-strong`
- `--homepage-border`
- `--homepage-text`
- `--homepage-muted`
- `--homepage-accent`

These tokens should resolve differently in light and dark modes so the homepage can keep its cinematic feel in dark mode while remaining clean and readable in light mode.

#### 2. Homepage shell

`HomepageShell` should become the outer canvas for the route. It should use the homepage background token, appropriate page padding, and a consistent vertical rhythm, but it should not change the order of welcome banner, hero banner, and content carousels.

#### 3. Welcome banner

The welcome banner should use the homepage surface token and theme-aware text colors instead of fixed `bg-black/30`, `text-white`, and `text-gray-400`. Its border and backdrop blur can stay, but the surface should read correctly in both themes.

#### 4. Hero banner

The hero banner should keep the image carousel behavior and overlay structure, but theme the gradient overlay, info panel, title, metadata, and dot indicators using homepage tokens. The overlay should still provide readable contrast over any backdrop image in both light and dark themes.

#### 5. Content carousel and content cards

Carousel headers, links, and cards should use homepage text and surface tokens instead of fixed white and gray values. The card image frame should retain its rounded, elevated look, but the surrounding shell, rating badge, title, and year should adapt to the active theme.

#### 6. Loading overlay

If the loading overlay is used on the homepage, it should also consume homepage theme tokens so the modal backdrop and copy remain legible in light mode.

### Verification

- Confirm the homepage still renders the same structure and content.
- Confirm the homepage looks intentionally dark in dark mode and clean/light in light mode.
- Confirm the homepage shell, hero banner, carousel, and cards all remain readable against the active theme.
- Run the homepage UI tests and repository lint after the changes.
