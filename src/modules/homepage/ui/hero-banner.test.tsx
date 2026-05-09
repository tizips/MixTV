import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HeroBanner } from "./hero-banner";
import { getHomepageData } from "../application/homepage-service";

describe("HeroBanner", () => {
  it("renders the hero items and frosted info panel", async () => {
    const data = await getHomepageData();
    const html = renderToStaticMarkup(<HeroBanner items={data.heroBanner} />);

    expect(html).toContain("backdrop-blur");
    expect(html).toContain(data.heroBanner[0].title);
  });
});
