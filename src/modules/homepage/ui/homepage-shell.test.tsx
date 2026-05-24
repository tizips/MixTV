// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { HomepageShell, createContinueWatchingItem, loadContinueWatching } from "./homepage-shell";
import { getHomepageData } from "../application/homepage-service";
import { defaultHomepageConfig } from "../domain/homepage-config";
import { renderToStaticMarkup } from "react-dom/server";
import { env } from "@/shared/env";

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
    className,
    href,
    prefetch,
    onClick,
  }: {
    children: ReactNode;
    className?: string;
    href: string;
    prefetch?: boolean;
    onClick?: () => void;
  }) => (
    <a className={className} data-prefetch={String(prefetch ?? true)} href={href} onClick={onClick}>
      {children}
    </a>
  ),
}));

function historyResponse(history = [
  {
    cover: "https://image.test/poster.jpg",
    id: "movie-1",
    is_favorite: true,
    original_episodes: 12,
    play_episodes: 4,
    source: "alpha",
    source_name: "Alpha",
    title: "庆余年 第二季",
    year: "2026",
  },
]) {
  return new Response(JSON.stringify({ history }), {
    headers: { "Content-Type": "application/json" },
  });
}

function renderHomepageShell(data: Awaited<ReturnType<typeof getHomepageData>>) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  act(() => {
    root.render(<HomepageShell data={data} />);
  });

  return { host, root };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

let fetchMock: ReturnType<typeof vi.fn>;
let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  fetchMock = vi.fn(async () => historyResponse());
  globalThis.fetch = fetchMock as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  document.body.innerHTML = "";
});

describe("HomepageShell", () => {
  it("renders the homepage with the welcome banner when enabled", async () => {
    const data = await getHomepageData();
    const markup = renderToStaticMarkup(<HomepageShell data={data} />);

    expect(markup).toContain(env.NEXT_PUBLIC_SITE_NAME);
    expect(markup).toContain("欢迎");
    expect(markup).toContain(data.heroBanner[0].title);
    expect(markup).not.toContain("继续观看");
    expect(markup).toContain("min-h-screen p-4 text-foreground");
    expect(markup).not.toContain("homepage-");
    expect(markup).not.toContain("bg-black/30");
  });

  it("hides the welcome banner when disabled in config", async () => {
    const data = await getHomepageData({
      ...defaultHomepageConfig,
      showWelcomeBanner: false,
    });

    const markup = renderToStaticMarkup(<HomepageShell data={data} />);

    expect(markup).not.toContain(`欢迎来到 ${env.NEXT_PUBLIC_SITE_NAME}`);
    expect(markup).not.toContain("探索精彩影视内容");
  });

  it("loads continue watching from the history API once", async () => {
    const [first, second] = await Promise.all([loadContinueWatching(), loadContinueWatching()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/history", { headers: { Accept: "application/json" } });
    expect(first).toEqual(second);
    expect(first[0]).toMatchObject({
      id: "movie-1",
      is_favorite: true,
      source_name: "Alpha",
      title: "庆余年 第二季",
    });
  });

  it("maps history items into continue watching card data", () => {
    const card = createContinueWatchingItem({
      cover: "https://image.test/poster.jpg",
      id: "movie-1",
      is_favorite: true,
      original_episodes: 12,
      play_episodes: 4,
      source: "alpha",
      source_name: "Alpha",
      title: "庆余年 第二季",
      year: "2026",
    });

    expect(card).toMatchObject({
      coverUrl: "https://image.test/poster.jpg",
      continueWatching: {
        currentEpisode: 4,
        latestEpisode: 12,
        sourceName: "Alpha",
        source: "alpha",
      },
      id: "movie-1",
      title: "庆余年 第二季",
      type: "tv",
      year: 2026,
    });
  });

  it("creates a favorite from the continue watching card", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === "/api/favorites/alpha/movie-1" && init?.method === "POST") {
        return new Response(JSON.stringify({ favorite: { id: "movie-1", source: "alpha" } }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      return historyResponse([
        {
          cover: "https://image.test/poster.jpg",
          id: "movie-1",
          is_favorite: false,
          original_episodes: 12,
          play_episodes: 4,
          source: "alpha",
          source_name: "Alpha",
          title: "庆余年 第二季",
          year: "2026",
        },
      ]);
    });
    const data = await getHomepageData();
    const { host, root } = renderHomepageShell(data);

    await act(async () => {
      await flushPromises();
    });

    const favoriteButton = host.querySelector('button[aria-label="收藏"]') as HTMLButtonElement | null;

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
    expect(host.querySelector('button[aria-label="取消收藏"]')).not.toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("deletes a continue watching card through the history API", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === "/api/history/alpha/movie-1") {
        return historyResponse([]);
      }

      return historyResponse();
    });
    const data = await getHomepageData();
    const { host, root } = renderHomepageShell(data);

    await act(async () => {
      await flushPromises();
    });

    expect(host.querySelector('a[href="/play?id=movie-1&source=alpha"]')).not.toBeNull();

    const deleteButton = host.querySelector('button[aria-label="删除"]') as HTMLButtonElement | null;

    if (!deleteButton) {
      throw new Error("Delete button was not rendered");
    }

    await act(async () => {
      deleteButton.click();
      await flushPromises();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/history/alpha/movie-1", {
      headers: { Accept: "application/json" },
      method: "DELETE",
    });
    expect(host.querySelector('a[href="/play?id=movie-1&source=alpha"]')).toBeNull();

    act(() => {
      root.unmount();
    });
  });
});
