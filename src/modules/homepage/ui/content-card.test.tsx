import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContentCard } from "./content-card";
import { getHomepageData } from "../application/homepage-service";

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

describe("ContentCard", () => {
  it("renders a tokenized card surface", async () => {
    const data = await getHomepageData();
    const item = data.sections.find((section) => section.items.length > 0)?.items[0];

    if (!item) {
      throw new Error("homepage sections are missing items");
    }

    const html = renderToStaticMarkup(<ContentCard item={item} />);

    expect(html).toContain(item.title);
    expect(html).toContain("bg-surface-secondary");
    expect(html).toContain("text-foreground");
    expect(html).toContain("bi-play-fill");
    expect(html).not.toContain("homepage-");
  });

  it("renders continue-watching progress and actions", async () => {
    const html = renderToStaticMarkup(
      <ContentCard
        item={continueWatchingItem}
        variant="continueWatching"
        isFavorite
      />,
    );

    expect(html).toContain("/play?id=");
    expect(html).toContain("source=");
    expect(html).toContain(`id=${continueWatchingItem.id}`);
    expect(html).toContain(`EP.${continueWatchingItem.continueWatching.currentEpisode}`);
    expect(html).toContain(`${continueWatchingItem.continueWatching.latestEpisode}`);
    expect(html).toContain(`+${continueWatchingItem.continueWatching.latestEpisode - continueWatchingItem.continueWatching.currentEpisode}`);
    expect(html).toContain(continueWatchingItem.continueWatching.sourceName);
    expect(html).toContain("justify-between");
    expect(html).toContain("收藏");
    expect(html).toContain("删除");
  });

  it("hides the extra episodes badge when there are no new episodes", async () => {
    const item = {
      ...continueWatchingItem,
      continueWatching: {
        currentEpisode: 12,
        latestEpisode: 12,
        sourceName: "Alpha",
        source: "alpha",
      },
    };

    const html = renderToStaticMarkup(
      <ContentCard
        item={item}
        variant="continueWatching"
      />,
    );

    expect(html).not.toContain("+0");
    expect(html).toContain("EP.12");
    expect(html).toContain("2024");
    expect(html).toContain("Alpha");
  });
});
