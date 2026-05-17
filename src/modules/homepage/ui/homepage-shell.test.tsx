import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { HomepageShell, createContinueWatchingItem, loadContinueWatching } from "./homepage-shell";
import { getHomepageData } from "../application/homepage-service";
import { defaultHomepageConfig } from "../domain/homepage-config";
import { renderToStaticMarkup } from "react-dom/server";
import { env } from "@/shared/env";

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

let fetchMock: ReturnType<typeof vi.fn>;
let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  fetchMock = vi.fn(async () => historyResponse());
  globalThis.fetch = fetchMock as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
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
});
