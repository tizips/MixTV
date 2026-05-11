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
    expect(html).toContain("bg-[var(--homepage-surface-strong)]");
    expect(html).toContain("text-[var(--homepage-text)]");
    expect(html).toContain("bi-play-circle");
    expect(html).not.toContain("bg-gray-800");
    expect(html).not.toContain("border-[var(--homepage-border)]");
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
    expect(html).toContain("收藏");
    expect(html).toContain("删除");
  });
});
