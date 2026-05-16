// @vitest-environment happy-dom

import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryPageShell } from "./history-page-shell";

vi.mock("next/image", () => ({
  default: ({
    alt,
    src,
  }: {
    alt?: string;
    src?: string | { src?: string };
  }) => <span data-alt={alt} data-src={typeof src === "string" ? src : src?.src ?? ""} />,
}));

vi.mock("next/link", () => ({
  default: ({ children, className, href }: { children: ReactNode; className?: string; href: string }) => (
    <a className={className} href={href}>
      {children}
    </a>
  ),
}));

vi.mock("@heroui/react", () => ({
  Button: ({
    children,
    isDisabled,
    onPress,
    type,
    variant,
    ...props
  }: {
    [key: string]: unknown;
    children: ReactNode;
    isDisabled?: boolean;
    onPress?: () => void;
    type?: "button" | "submit" | "reset";
    variant?: string;
  }) => (
    <button {...props} data-variant={variant} disabled={isDisabled} type={type ?? "button"} onClick={onPress}>
      {children}
    </button>
  ),
  Chip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  ProgressBar: ({ value }: { value?: number }) => <div data-progress={value} />,
}));

function renderHistoryPageShell() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  act(() => {
    root.render(<HistoryPageShell />);
  });

  return { host, root };
}

function renderHistoryPageShellInStrictMode() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  act(() => {
    root.render(
      <StrictMode>
        <HistoryPageShell />
      </StrictMode>,
    );
  });

  return { host, root };
}

function historyResponse(history = [
  {
    cover: "https://image.test/poster.jpg",
    douban_id: 0,
    id: "movie-1",
    original_episodes: 12,
    play_time: 1061,
    play_episodes: 2,
    remarks: "更新至12集",
    save_time: 1768471200000,
    search_title: "",
    source: "alpha",
    source_name: "Alpha",
    title: "庆余年 第二季",
    total_time: 1247,
    year: "2026",
  },
]) {
  return new Response(JSON.stringify({ history }), {
    headers: { "Content-Type": "application/json" },
  });
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => historyResponse());
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("HistoryPageShell", () => {
  it("loads history only once when mounted in Strict Mode", async () => {
    const { host, root } = renderHistoryPageShellInStrictMode();

    await act(async () => {
      await flushPromises();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/history", { headers: { Accept: "application/json" } });
    expect(host.textContent).toContain("庆余年 第二季");

    act(() => {
      root.unmount();
    });
  });

  it("loads and renders history from the history API", async () => {
    const { host, root } = renderHistoryPageShell();

    await act(async () => {
      await flushPromises();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/history", { headers: { Accept: "application/json" } });
    expect(host.textContent).toContain("观看历史");
    expect(host.textContent).toContain("庆余年 第二季");
    expect(host.textContent).toContain("Alpha");
    expect(host.textContent).toContain("EP.2/12");
    expect(host.querySelector('a[href="/play?source=alpha&id=movie-1"]')).not.toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("removes a history entry and replaces the list from the delete response", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === "/api/history/alpha/movie-1") {
        return historyResponse([]);
      }

      if (url === "/api/favorites/alpha/movie-1") {
        return new Response(JSON.stringify({ favorite: { id: "movie-1", source: "alpha" } }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      return historyResponse();
    });

    const { host, root } = renderHistoryPageShell();

    await act(async () => {
      await flushPromises();
    });

    const removeButton = host.querySelector('button[aria-label="移除观看记录 庆余年 第二季"]') as HTMLButtonElement | null;

    if (!removeButton) {
      throw new Error("Remove history button was not rendered");
    }

    await act(async () => {
      removeButton.click();
      await flushPromises();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/history/alpha/movie-1", {
      headers: { Accept: "application/json" },
      method: "DELETE",
    });
    expect(host.textContent).not.toContain("庆余年 第二季");
    expect(host.textContent).toContain("还没有观看历史");

    act(() => {
      root.unmount();
    });
  });

  it("creates a favorite from the history card", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === "/api/favorites/alpha/movie-1" && init?.method === "POST") {
        return new Response(JSON.stringify({ favorite: { id: "movie-1", source: "alpha" } }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      return historyResponse();
    });

    const { host, root } = renderHistoryPageShell();

    await act(async () => {
      await flushPromises();
    });

    const favoriteButton = host.querySelector('button[aria-label="收藏 庆余年 第二季"]') as HTMLButtonElement | null;

    if (!favoriteButton) {
      throw new Error("Favorite button was not rendered");
    }

    await act(async () => {
      favoriteButton.click();
      await flushPromises();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/favorites/alpha/movie-1", {
      headers: { Accept: "application/json" },
      method: "POST",
    });

    act(() => {
      root.unmount();
    });
  });
});
