# Header Theme Toggle Design

## Context

`src/components/site-header.tsx` renders the shared fixed header and places `UserMenu` on the right. Global theme variables already support automatic system themes through `prefers-color-scheme` and explicit overrides through `:root[data-theme="light"]` and `:root[data-theme="dark"]` in `src/app/globals.css`.

## Goal

Add a compact theme button immediately to the left of `UserMenu`. The button lets users cycle through `auto`, `light`, and `dark` theme modes without changing the existing navigation structure.

## UI

Use the selected compact circular icon style:

- 40px square circular HeroUI `Button` with `isIconOnly` and `variant="light"`.
- Position inside the existing right-side header action group, before `<UserMenu />`.
- Bootstrap Icons communicate the current mode:
- `auto`: `bi-circle-half`
- `light`: `bi-sun-fill`
- `dark`: `bi-moon-stars-fill`
- Accessible label describes the current mode and that activating the button switches theme mode.

## Behavior

Theme mode cycles in this order: `auto -> light -> dark -> auto`.

- `auto` removes the `data-theme` attribute from `document.documentElement`, allowing the existing CSS media query to follow the OS theme.
- `light` sets `document.documentElement.dataset.theme = "light"`.
- `dark` sets `document.documentElement.dataset.theme = "dark"`.
- The selected mode is stored in `localStorage` so future visits keep the same mode. `auto` is stored explicitly as `auto`.

The button runs only on the client. It should initialize from `localStorage` after mount, defaulting to `auto` when no valid value exists.

## Testing

Update header/component tests to verify:

- The theme toggle renders before the user menu in the shared header markup.
- The toggle uses an accessible label for theme switching.
- Existing assertions that the legacy theme shell is absent still pass.

Interactive localStorage and DOM mutation behavior can be covered with a focused client component test if the implementation extracts the button into its own component.
