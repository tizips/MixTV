import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import HomePage from "@/app/page";
import { env } from "@/shared/env";

const homepageConfigMock = vi.hoisted(() =>
  vi.fn(async () => ({
    modules: {
      carousel: false,
      "coming-soon": false,
      "continue-watching": true,
      "new-anime": false,
      "trending-movies": false,
      "trending-series": false,
      "trending-short-dramas": false,
      "trending-variety": false,
      "welcome-announcement": true,
    },
    updatedAt: "2026-05-16T00:00:00.000Z",
  })),
);

vi.mock("@/modules/admin/server/homepage-modules-service", () => ({
  defaultHomepageConfig: {
    modules: {
      carousel: true,
      "coming-soon": true,
      "continue-watching": true,
      "new-anime": true,
      "trending-movies": true,
      "trending-series": true,
      "trending-short-dramas": true,
      "trending-variety": true,
      "welcome-announcement": true,
    },
    updatedAt: null,
  },
  getHomepageConfig: homepageConfigMock,
}));

beforeEach(() => {
  homepageConfigMock.mockClear();
});

describe("HomePage", () => {
  it("renders the homepage content", async () => {
    const html = renderToStaticMarkup(await HomePage());
    expect(html).toContain(env.NEXT_PUBLIC_SITE_NAME);
  });

  it("does not render the continue watching placeholder on the server", async () => {
    const html = renderToStaticMarkup(await HomePage());

    expect(html).not.toContain("继续观看");
    expect(html).not.toContain("焦点轮播");
    expect(html).not.toContain("即将上线");
    expect(html).not.toContain("热门电影");
    expect(html).not.toContain("热门剧集");
    expect(html).not.toContain("新番动漫");
    expect(html).not.toContain("热门综艺");
    expect(html).not.toContain("热门短剧");
  });

  it("falls back to default homepage config when storage is unavailable", async () => {
    const error = new Error("Connection timeout");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    homepageConfigMock.mockRejectedValueOnce(error);

    const html = renderToStaticMarkup(await HomePage());

    expect(html).toContain(env.NEXT_PUBLIC_SITE_NAME);
    expect(html).toContain("热门电影");
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to load homepage config; falling back to defaults.",
      error,
    );

    consoleError.mockRestore();
  });
});
