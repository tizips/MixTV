import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContentCarousel } from "./content-carousel";
import { getHomepageData } from "../application/homepage-service";

describe("ContentCarousel", () => {
  it("renders a section title and content cards", async () => {
    const data = await getHomepageData();
    const section = data.sections[0];
    const html = renderToStaticMarkup(<ContentCarousel title={section.title} items={section.items} />);

    expect(html).toContain(section.title);
    expect(html).toContain(section.items[0].title);
  });
});
