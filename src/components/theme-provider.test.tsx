// @vitest-environment happy-dom

import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeProvider, useTheme } from "./theme-provider";

const storageKey = "mixtv-theme-mode";

let systemPrefersDark = false;
let mediaListeners: Array<(event: MediaQueryListEvent) => void> = [];

function ThemeProbe() {
  const { resolvedTheme, setTheme, theme } = useTheme();

  return (
    <button
      data-resolved-theme={resolvedTheme}
      data-theme={theme}
      onClick={() => setTheme("light")}
    >
      Theme probe
    </button>
  );
}

function renderClient(children: ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  act(() => {
    root.render(<ThemeProvider storageKey={storageKey}>{children}</ThemeProvider>);
  });

  return { host, root };
}

beforeEach(() => {
  systemPrefersDark = false;
  mediaListeners = [];
  localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.style.colorScheme = "";

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({
      addEventListener: (
        eventName: string,
        listener: (event: MediaQueryListEvent) => void,
      ) => {
        if (eventName === "change") {
          mediaListeners.push(listener);
        }
      },
      addListener: (listener: (event: MediaQueryListEvent) => void) => {
        mediaListeners.push(listener);
      },
      matches: systemPrefersDark,
      media: query,
      removeEventListener: (
        eventName: string,
        listener: (event: MediaQueryListEvent) => void,
      ) => {
        if (eventName === "change") {
          mediaListeners = mediaListeners.filter((item) => item !== listener);
        }
      },
      removeListener: (listener: (event: MediaQueryListEvent) => void) => {
        mediaListeners = mediaListeners.filter((item) => item !== listener);
      },
    })),
  });
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("ThemeProvider", () => {
  it("does not render script tags from the client provider", () => {
    const html = renderToStaticMarkup(
      <ThemeProvider storageKey={storageKey}>
        <div data-testid="child" />
      </ThemeProvider>,
    );

    expect(html).toContain('data-testid="child"');
    expect(html).not.toContain("<script");
  });

  it("applies the stored theme to the document", () => {
    localStorage.setItem(storageKey, "dark");

    const { host, root } = renderClient(<ThemeProbe />);
    const button = host.querySelector("button");

    expect(button?.getAttribute("data-theme")).toBe("dark");
    expect(button?.getAttribute("data-resolved-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");

    act(() => {
      root.unmount();
    });
  });

  it("persists explicit theme changes", () => {
    systemPrefersDark = true;
    localStorage.setItem(storageKey, "system");

    const { host, root } = renderClient(<ThemeProbe />);
    const button = host.querySelector("button");

    expect(document.documentElement.classList.contains("dark")).toBe(true);

    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(localStorage.getItem(storageKey)).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("light");

    act(() => {
      root.unmount();
    });
  });
});
