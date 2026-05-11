// @vitest-environment happy-dom

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

  return { button, root };
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
