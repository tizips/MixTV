// @vitest-environment happy-dom

import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchPageShell } from "./search-page-shell";

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
  default: ({
    children,
    href,
    prefetch,
    rel,
    target,
  }: {
    children: ReactNode;
    href: string;
    prefetch?: boolean;
    rel?: string;
    target?: string;
  }) => <a data-prefetch={String(prefetch ?? true)} href={href} rel={rel} target={target}>{children}</a>,
}));

vi.mock("@heroui/react", () => ({
  Button: ({
    children,
    onPress,
    type,
    variant,
  }: {
    children: ReactNode;
    onPress?: () => void;
    type?: "button" | "submit" | "reset";
    variant?: string;
  }) => (
    <button data-variant={variant} type={type ?? "button"} onClick={onPress}>
      {children}
    </button>
  ),
  Chip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("@tanstack/react-virtual", () => ({
  useWindowVirtualizer: () => ({
    getTotalSize: () => 480,
    getVirtualItems: () => [{ index: 0, key: 0, start: 0 }],
    measure: vi.fn(),
    measureElement: vi.fn(),
    options: { scrollMargin: 0 },
  }),
}));

function renderSearchPageShell() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  act(() => {
    root.render(<SearchPageShell />);
  });

  return { host, root };
}

function renderSearchPageShellInStrictMode() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  act(() => {
    root.render(
      <StrictMode>
        <SearchPageShell />
      </StrictMode>,
    );
  });

  return { host, root };
}

function mediaSearchResponse() {
  return new Response(
    [
      'event: start\ndata: {"total":1}\n\n',
      'event: result\ndata: [{"total_episodes":2,"idx":"title:qingyunian:year:2026","id":"movie-1","key":"alpha","cover":"https://image.test/poster.jpg","source_name":"Alpha","title":"庆余年 第二季","year":"2026"}]\n\n',
      'event: complete\ndata: {"completed":1,"total":1}\n\n',
    ].join(""),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

function aggregatedMediaSearchResponse() {
  return new Response(
    [
      'event: start\ndata: {"total":2}\n\n',
      'event: result\ndata: [{"total_episodes":1,"idx":"title:samemovie:year:2026","id":"a","key":"alpha","cover":"https://image.test/a.jpg","source_name":"Alpha","title":"Same Movie","year":"2026"}]\n\n',
      'event: result\ndata: [{"total_episodes":1,"idx":"title:samemovie:year:2026","id":"a","key":"alpha","cover":"https://image.test/a.jpg","source_name":"Alpha","title":"Same Movie","year":"2026"}]\n\n',
      'event: complete\ndata: {"completed":2,"total":2}\n\n',
    ].join(""),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

function searchHistoryResponse(history = ["庆余年", "沙丘"]) {
  return new Response(JSON.stringify({ history }), {
    headers: { "Content-Type": "application/json" },
  });
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

let originalUrl = "";
let replaceStateSpy: ReturnType<typeof vi.spyOn>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  originalUrl = window.location.pathname + window.location.search + window.location.hash;
  window.history.pushState(null, "", "/search");
  replaceStateSpy = vi.spyOn(window.history, "replaceState");
  vi.useFakeTimers();
  (globalThis as typeof globalThis & {
    matchMedia?: typeof window.matchMedia;
  }).matchMedia = vi.fn((query: string) => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();

    return {
      addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener);
      }),
      addListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener);
      }),
      dispatchEvent: vi.fn((event: Event) => {
        listeners.forEach((listener) => listener(event as MediaQueryListEvent));
        return true;
      }),
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener);
      }),
      removeListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener);
      }),
    } as MediaQueryList;
  });
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (url === "/api/search/histories") {
      return searchHistoryResponse();
    }

    return mediaSearchResponse();
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  replaceStateSpy.mockRestore();
  Reflect.deleteProperty(globalThis, "matchMedia");
  window.history.pushState(null, "", originalUrl);
  document.body.innerHTML = "";
});

describe("SearchPageShell", () => {
  it("loads search history only once when mounted in Strict Mode", async () => {
    const { host, root } = renderSearchPageShellInStrictMode();

    await act(async () => {
      await flushPromises();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/search/histories", {
      headers: { Accept: "application/json" },
    });
    expect(host.textContent).toContain("庆余年");

    act(() => {
      root.unmount();
    });
  });

  it("streams media results from the search API", async () => {
    const { host, root } = renderSearchPageShell();

    await act(async () => {
      await flushPromises();
    });

    const historySearchButton = host.querySelector('button[aria-label="搜索 庆余年"]') as HTMLButtonElement | null;

    if (!historySearchButton) {
      throw new Error("Search form elements were not rendered");
    }

    await act(async () => {
      historySearchButton.click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/search/histories", {
      headers: { Accept: "application/json" },
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/search/media?q=%E5%BA%86%E4%BD%99%E5%B9%B4", {
      headers: { Accept: "text/event-stream" },
      signal: expect.any(AbortSignal),
    });
    expect(host.textContent).toContain("庆余年 第二季");
    expect(host.textContent).toContain("已完成 1/1");
    expect(host.textContent).not.toContain("正在连接搜索源");
    expect(replaceStateSpy).not.toHaveBeenCalled();
    expect(window.location.pathname + window.location.search).toBe("/search");
    expect(host.querySelector('a[data-prefetch="false"][href="/play?source=alpha&id=movie-1"]')).not.toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("creates and deletes favorites from the first returned source on a search result", async () => {
    const { host, root } = renderSearchPageShell();

    await act(async () => {
      await flushPromises();
    });

    const historySearchButton = host.querySelector('button[aria-label="搜索 庆余年"]') as HTMLButtonElement | null;

    if (!historySearchButton) {
      throw new Error("Search form elements were not rendered");
    }

    await act(async () => {
      historySearchButton.click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    const favoriteButton = host.querySelector('button[aria-label="收藏 庆余年 第二季"]') as HTMLButtonElement | null;

    if (!favoriteButton) {
      throw new Error("Favorite button was not rendered");
    }

    await act(async () => {
      favoriteButton.click();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/favorites/alpha/movie-1", {
      headers: {
        Accept: "application/json",
      },
      method: "POST",
    });

    const unfavoriteButton = host.querySelector('button[aria-label="取消收藏 庆余年 第二季"]') as HTMLButtonElement | null;

    if (!unfavoriteButton) {
      throw new Error("Unfavorite button was not rendered");
    }

    await act(async () => {
      unfavoriteButton.click();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/favorites/alpha/movie-1", {
      headers: { Accept: "application/json" },
      method: "DELETE",
    });

    act(() => {
      root.unmount();
    });
  });

  it("updates one result card when additional sources are aggregated", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === "/api/search/histories") {
        return searchHistoryResponse();
      }

      return aggregatedMediaSearchResponse();
    });
    const { host, root } = renderSearchPageShell();

    await act(async () => {
      await flushPromises();
    });

    const historySearchButton = host.querySelector('button[aria-label="搜索 庆余年"]') as HTMLButtonElement | null;

    if (!historySearchButton) {
      throw new Error("Search form elements were not rendered");
    }

    await act(async () => {
      historySearchButton.click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(host.querySelectorAll('[role="listitem"]')).toHaveLength(1);
    expect(host.textContent).toContain("Same Movie");
    expect(host.textContent).toContain("1源");
    expect(host.textContent).toContain("已完成 2/2");

    const playLink = Array.from(host.querySelectorAll("a")).find(
      (element) => element.getAttribute("href") === "/play?source=alpha&id=a",
    ) as HTMLAnchorElement | undefined;

    if (!playLink) {
      throw new Error("Play link was not rendered");
    }

    expect(playLink.getAttribute("target")).toBe("_blank");

    act(() => {
      root.unmount();
    });
  });

  it("does not rerun search when switching resource type after a search", async () => {
    const { host, root } = renderSearchPageShell();

    await act(async () => {
      await flushPromises();
    });

    const historySearchButton = host.querySelector('button[aria-label="搜索 庆余年"]') as HTMLButtonElement | null;

    if (!historySearchButton) {
      throw new Error("Search form elements were not rendered");
    }

    await act(async () => {
      historySearchButton.click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    const resultCountBefore = host.querySelectorAll('[role="listitem"]').length;
    expect(resultCountBefore).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const cloudTypeButton = Array.from(host.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("网盘资源"),
    ) as HTMLButtonElement | undefined;

    if (!cloudTypeButton) {
      throw new Error("Search type switch button was not rendered");
    }

    await act(async () => {
      cloudTypeButton.click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    const resultCountAfter = host.querySelectorAll('[role="listitem"]').length;
    expect(resultCountAfter).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(host.textContent).not.toContain("正在连接搜索源");
    expect(replaceStateSpy).not.toHaveBeenCalled();
    expect(window.location.pathname + window.location.search).toBe("/search");

    act(() => {
      root.unmount();
    });
  });

  it("loads and deletes search history through the history API", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === "/api/search/histories/%E5%BA%86%E4%BD%99%E5%B9%B4" && init?.method === "DELETE") {
        return searchHistoryResponse(["沙丘"]);
      }

      if (url === "/api/search/histories") {
        return searchHistoryResponse(["庆余年", "沙丘"]);
      }

      return mediaSearchResponse();
    });

    const { host, root } = renderSearchPageShell();

    await act(async () => {
      await flushPromises();
    });

    expect(host.textContent).toContain("庆余年");
    expect(host.textContent).toContain("沙丘");

    const deleteButton = host.querySelector('button[aria-label="删除搜索历史 庆余年"]') as HTMLButtonElement | null;

    if (!deleteButton) {
      throw new Error("Search history delete button was not rendered");
    }

    await act(async () => {
      deleteButton.click();
    });

    await act(async () => {
      await flushPromises();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/search/histories/%E5%BA%86%E4%BD%99%E5%B9%B4", {
      headers: {
        Accept: "application/json",
      },
      method: "DELETE",
    });
    expect(host.textContent).not.toContain("庆余年");
    expect(host.textContent).toContain("沙丘");

    act(() => {
      root.unmount();
    });
  });
});
