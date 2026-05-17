import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContentCarousel } from "./content-carousel";

const continueWatchingItem = {
  id: "cw-1",
  title: "繁城之下",
  coverUrl: "https://image.test/poster.jpg",
  rating: 8.1,
  year: 2024,
  type: "tv" as const,
  continueWatching: {
    currentEpisode: 12,
    latestEpisode: 16,
    sourceName: "腾讯视频",
    source: "txvideo",
  },
};

describe("ContentCarousel", () => {
  it("renders a section title and tokenized content cards", () => {
    const html = renderToStaticMarkup(
      <ContentCarousel
        title="继续观看"
        icon="bi-play-circle-fill"
        iconClass="text-danger"
        items={[continueWatchingItem]}
        moreLink="/updates"
        variant="continueWatching"
      />,
    );

    expect(html).toContain("继续观看");
    expect(html).toContain(continueWatchingItem.title);
    expect(html).toContain("bi-play-circle-fill");
    expect(html).toContain("text-danger");
    expect(html).toContain("查看更多");
    expect(html).toContain("bi-chevron-right");
    expect(html).toContain("EP.12");
    expect(html).toContain("16");
    expect(html).toContain("腾讯视频");
    expect(html).toContain("text-foreground");
    expect(html).toContain("text-muted");
    expect(html).not.toContain("text-gray-400");
  });
});
