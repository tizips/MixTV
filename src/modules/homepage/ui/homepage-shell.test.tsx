import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HomepageShell } from "./homepage-shell";
import { getHomepageData } from "../application/homepage-service";
import { defaultHomepageConfig } from "../domain/homepage-config";

describe("HomepageShell", () => {
  it("renders the homepage with the welcome banner when enabled", async () => {
    const data = await getHomepageData();
    const html = renderToStaticMarkup(<HomepageShell data={data} />);

    expect(html).toContain("MixTV");
    expect(html).toContain("欢迎");
    expect(html).toContain(data.heroBanner[0].title);
    expect(html).toContain("min-h-screen p-4 text-[var(--homepage-text)]");
    expect(html).not.toContain("bg-[var(--homepage-bg)]");
    expect(html).not.toContain("bg-gray-900");
    expect(html).not.toContain("bg-black/30");
  });

  it("hides the welcome banner when disabled in config", async () => {
    const data = await getHomepageData({
      ...defaultHomepageConfig,
      showWelcomeBanner: false,
    });

    const html = renderToStaticMarkup(<HomepageShell data={data} />);

    expect(html).not.toContain("欢迎来到 MixTV");
    expect(html).not.toContain("探索精彩影视内容");
  });
});
