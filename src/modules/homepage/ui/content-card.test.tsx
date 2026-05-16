import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContentCard } from "./content-card";
import { getHomepageData } from "../application/homepage-service";

describe("ContentCard", () => {
  it("renders a tokenized card surface", async () => {
    const data = await getHomepageData();
    const item = data.sections[0].items[0];
    const html = renderToStaticMarkup(<ContentCard item={item} />);

    expect(html).toContain(item.title);
    expect(html).toContain("bg-surface-secondary");
    expect(html).toContain("text-foreground");
    expect(html).toContain("bi-play-fill");
    expect(html).not.toContain("homepage-");
  });

  it("renders continue-watching progress and actions", async () => {
    const data = await getHomepageData();
    const section = data.sections.find((currentSection) => currentSection.key === "continueWatching");

    if (!section) {
      throw new Error("continueWatching section is missing");
    }

    const item = section.items[0];
    if (!item.continueWatching) {
      throw new Error("continueWatching metadata is missing");
    }

    const html = renderToStaticMarkup(
      <ContentCard
        item={item}
        variant="continueWatching"
        isFavorite
      />,
    );

    expect(html).toContain(`EP.${item.continueWatching.currentEpisode}`);
    expect(html).toContain(`${item.continueWatching.latestEpisode}`);
    expect(html).toContain(`+${item.continueWatching.latestEpisode - item.continueWatching.currentEpisode}`);
    expect(html).toContain(item.continueWatching.sourceName);
    expect(html).toContain("justify-between");
    expect(html).toContain("收藏");
    expect(html).toContain("删除");
  });

  it("hides the extra episodes badge when there are no new episodes", async () => {
    const data = await getHomepageData();
    const section = data.sections.find((currentSection) => currentSection.key === "continueWatching");

    if (!section) {
      throw new Error("continueWatching section is missing");
    }

    const baseItem = section.items[0];
    const item = {
      ...baseItem,
      continueWatching: {
        currentEpisode: 12,
        latestEpisode: 12,
        sourceName: "Alpha",
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
