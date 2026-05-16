import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import HomePage from "@/app/page";
import { env } from "@/shared/env";

vi.mock("@/modules/admin/server/homepage-modules-service", () => ({
  getHomepageConfig: vi.fn(async () => ({
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
}));

describe("HomePage", () => {
  it("renders the homepage content", async () => {
    const html = renderToStaticMarkup(await HomePage());
    expect(html).toContain(env.NEXT_PUBLIC_SITE_NAME);
  });

  it("renders only the homepage modules enabled by admin config", async () => {
    const html = renderToStaticMarkup(await HomePage());

    expect(html).toContain("继续观看");
    expect(html).not.toContain("焦点轮播");
    expect(html).not.toContain("即将上线");
    expect(html).not.toContain("热门电影");
    expect(html).not.toContain("热门剧集");
    expect(html).not.toContain("新番动漫");
    expect(html).not.toContain("热门综艺");
    expect(html).not.toContain("热门短剧");
  });
});
