# MixTV HeroUI Global UI Design

## Context

MixTV currently uses a custom Tailwind-based shell with handwritten header, menus, theme handling, and page chrome. The request is to replace the full UI layer with `@heroui/react` and `@heroui/styles` across the whole application, and to shift the visual language to HeroUI's standard light, neutral presentation.

The application architecture should stay intact:

- Business logic remains in `src/modules/*`.
- `src/app/*` continues to handle routing and page orchestration.
- Shared UI primitives live in `src/components/*` and module-local UI lives in `src/modules/*/ui`.

## Goals

1. Make HeroUI the default UI system for the whole app.
2. Replace custom shell components with HeroUI equivalents.
3. Remove the current bespoke dark cinematic background and theme system.
4. Keep existing routes, module boundaries, and data flow intact.
5. Preserve functional behavior while changing only presentation and shell composition.

## Non-Goals

1. Rewriting business logic or page data sources.
2. Redesigning route structure.
3. Introducing a new design system alongside HeroUI.
4. Adding new product features as part of the migration.

## Recommended Approach

Use a single global migration:

1. Install and wire HeroUI at the app root.
2. Replace the current shell components with HeroUI components.
3. Update all route-level page chrome to use HeroUI containers, cards, menus, buttons, and tabs where appropriate.
4. Remove the old theme toggle and custom `globals.css` theme machinery unless a specific page needs a narrow exception.

This is the lowest-risk way to achieve a genuinely global replacement without mixing two UI systems for an extended period.

## Design

### 1. App Root Integration

`src/app/layout.tsx` will become the single integration point for HeroUI. The root layout should:

- Import the HeroUI stylesheet contract from `@heroui/styles` as required by the library.
- Wrap the application with the HeroUI provider exported by `@heroui/react`.
- Use a neutral light default theme at the app level.
- Keep `bootstrap-icons` available only if any icons still depend on it during migration; otherwise remove it once replacement is complete.

The root body should stop setting custom background gradients and should instead let HeroUI components define the page surface.

### 2. Global Styles

`src/app/globals.css` should be reduced to the smallest possible set of global rules:

- library-required base imports and resets
- any unavoidable application-wide utility rule that HeroUI does not cover
- no app-specific color system, gradient background, or theme variables from the current implementation

The current CSS variables for homepage background, foreground, borders, and theme switching should be deleted. The app should no longer depend on `data-theme` toggling or `prefers-color-scheme` custom overrides for its baseline look.

### 3. Shared Shell Components

The current header and menu stack should be replaced with HeroUI-based equivalents:

- `SiteHeader` becomes a HeroUI `Navbar`-style shell with brand, centered navigation, and a right-side action area.
- `UserMenu` becomes a HeroUI `Dropdown`/`Menu` composition.
- `ThemeToggle` is removed from the primary UI because the target visual language is a standard light HeroUI presentation.

The header should still surface the same navigational destinations and user actions, but its rendering should use HeroUI primitives rather than custom button/menu markup.

### 4. Page Chrome and Route Surfaces

All route entries should present through HeroUI surfaces instead of raw Tailwind wrappers. Examples:

- home and placeholder pages use `Container` and `Card`
- admin/settings/stats-style pages use HeroUI layout primitives and surface components
- navigation or section switching uses HeroUI `Tabs` where the interaction fits

This migration should not force every module to be rewritten at once. The requirement is that every route is visually rendered through HeroUI components, even if the underlying module content remains the same.

### 5. Module UI Migration

Module UI under `src/modules/homepage/ui` should be updated so that its public shell and visible controls use HeroUI components where they are currently custom. The content model and module APIs should remain unchanged.

The migration should preserve the existing homepage data flow:

- `getHomepageData()` remains the source of data.
- `HomepageShell` remains the composition boundary for homepage rendering.
- Only the UI primitives and wrappers change.

### 6. Icons and Visual Tokens

HeroUI should be the visual baseline. Existing Bootstrap Icons may be kept temporarily for migration if replacing them in one pass would add noise, but the final state should not depend on a custom icon-orchestration layer outside HeroUI unless a page needs it for a specific control.

Color usage should follow HeroUI defaults and neutral accents. Any custom accent colors should be limited to brand-level details, not the overall page background or shell chrome.

## Implementation Boundaries

Allowed changes:

- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/components/*`
- `src/modules/*/ui/*`
- dependency additions to `package.json` and lockfile

Not allowed unless strictly required by the migration:

- changing module domain/application logic
- changing route paths
- introducing a second design system

## Acceptance Criteria

1. The app installs and uses `@heroui/react` and `@heroui/styles` as the primary UI layer.
2. The old custom theme toggle/background system is gone from the global shell.
3. Header, menu, and page containers are rendered with HeroUI components.
4. All existing routes still render successfully.
5. The app visually reads as a standard light, neutral HeroUI site instead of the current dark cinematic theme.
6. `bun run lint`, `bun run test`, and `bun run build` pass after the migration.

## Verification Plan

- Update or replace tests that assert legacy shell classes or CSS variables.
- Add tests for the new root shell and menu interactions where they matter.
- Run the full validation set after migration: lint, tests, and production build.

## Rollout Notes

The migration should be executed in a single pass if possible so the UI does not remain split between two systems. If the HeroUI package API requires small adapter code, keep that adapter isolated in the shared shell layer rather than spreading compatibility logic across route pages.
