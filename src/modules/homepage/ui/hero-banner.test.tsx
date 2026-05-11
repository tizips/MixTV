import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HeroBanner } from "./hero-banner";
import { getHomepageData } from "../application/homepage-service";

describe("HeroBanner", () => {
  it("renders the hero items with theme tokens", async () => {
    const data = await getHomepageData();
    const html = renderToStaticMarkup(<HeroBanner items={data.heroBanner} />);

    expect(html).toContain(data.heroBanner[0].title);
    expect(html).toContain("bg-[var(--homepage-surface)]");
    expect(html).toContain("text-[var(--homepage-text)]");
    expect(html).not.toContain("bg-black/30");
    expect(html).not.toContain("bg-gray-900");
    expect(html).not.toContain("border-[var(--homepage-border)]");
  });
});
