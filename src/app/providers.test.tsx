// @vitest-environment happy-dom

import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Providers } from "./providers";

vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useTheme: () => ({ resolvedTheme: "light" }),
}));

describe("Providers", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("marks benign ViewTransition rejections as handled", async () => {
    const finishedCatch = vi.fn();
    const finished = {
      catch: finishedCatch,
    } as unknown as Promise<void>;
    const startViewTransition = vi.fn(() => ({
      finished,
      ready: Promise.resolve(),
      updateCallbackDone: Promise.resolve(),
    }));
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: startViewTransition,
    });

    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    act(() => {
      root.render(
        <Providers>
          <div />
        </Providers>,
      );
    });

    document.startViewTransition?.(() => undefined);

    expect(finishedCatch).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
  });
});
