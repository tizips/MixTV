// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeToggle } from "./theme-toggle";

const themeState = vi.hoisted(() => ({
  setTheme: vi.fn(),
  theme: "system" as string | undefined,
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    setTheme: themeState.setTheme,
    theme: themeState.theme,
  }),
}));

beforeEach(() => {
  themeState.theme = "system";
  themeState.setTheme.mockImplementation((theme: string) => {
    themeState.theme = theme;
  });
});

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

  return { button, root };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("ThemeToggle", () => {
  it("renders a stable server placeholder", () => {
    const html = renderToStaticMarkup(<ThemeToggle />);

    expect(html).toContain("主题切换初始化中");
    expect(html).toContain("bi-circle-half");
  });

  it("cycles automatic to light to dark to automatic", () => {
    const { button, root } = renderClient();

    act(() => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(themeState.setTheme).toHaveBeenLastCalledWith("light");

    act(() => {
      root.render(<ThemeToggle />);
    });

    act(() => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(themeState.setTheme).toHaveBeenLastCalledWith("dark");

    act(() => {
      root.render(<ThemeToggle />);
    });

    act(() => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(themeState.setTheme).toHaveBeenLastCalledWith("system");

    act(() => {
      root.unmount();
    });
  });

  it("renders the current dark preference", () => {
    themeState.theme = "dark";

    const { button, root } = renderClient();

    expect(button.getAttribute("aria-label")).toContain("当前深色");
    expect(button.innerHTML).toContain("bi-moon-stars-fill");

    act(() => {
      root.unmount();
    });
  });
});
