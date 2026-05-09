import { describe, expect, it } from "vitest";
import { defaultHomepageConfig } from "../domain/homepage-config";
import { getHomepageData } from "./homepage-service";

describe("getHomepageData", () => {
  it("filters disabled sections out of the result", async () => {
    const data = await getHomepageData({
      ...defaultHomepageConfig,
      showHotVariety: false,
      showNewAnime: false,
    });

    expect(data.sections.map((section) => section.key)).not.toContain("hotVariety");
    expect(data.sections.map((section) => section.key)).not.toContain("newAnime");
  });
});
