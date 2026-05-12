import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContentCarousel } from "./content-carousel";
import { getHomepageData } from "../application/homepage-service";

describe("ContentCarousel", () => {
  it("renders a section title and tokenized content cards", async () => {
    const data = await getHomepageData();
    const section = data.sections[0];
    const html = renderToStaticMarkup(
      <ContentCarousel
        title={section.title}
        icon={section.icon}
        iconClass={section.iconClass}
        items={section.items}
        moreLink="/updates"
        variant="continueWatching"
      />,
    );

    expect(html).toContain(section.title);
    expect(html).toContain(section.items[0].title);
    expect(html).toContain(section.icon);
    expect(html).toContain(section.iconClass);
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
