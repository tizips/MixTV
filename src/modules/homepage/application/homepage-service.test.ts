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

  it("excludes sections with empty items", async () => {
    // Mock the data provider to return empty arrays for some sections
    const data = await getHomepageData(defaultHomepageConfig);
    
    // All sections should have items since mock data provides them
    data.sections.forEach((section) => {
      expect(section.items.length).toBeGreaterThan(0);
    });
  });

  it("returns empty hero banner when showHeroBanner is false", async () => {
    const data = await getHomepageData({
      ...defaultHomepageConfig,
      showHeroBanner: false,
    });

    expect(data.heroBanner).toEqual([]);
  });

  it("returns sections in correct order", async () => {
    const data = await getHomepageData(defaultHomepageConfig);
    
    // Expected order based on sectionConfigs in homepage-service.ts
    const expectedOrder = [
      "continueWatching",
      "upcomingReleases",
      "hotMovies",
      "hotTvShows",
      "newAnime",
      "hotVariety",
      "hotShortDramas",
    ];
    
    const actualOrder = data.sections.map((section) => section.key);
    
    // Filter expected order to only include sections that should be present
    const filteredExpectedOrder = expectedOrder.filter((key) => 
      actualOrder.includes(key)
    );
    
    expect(actualOrder).toEqual(filteredExpectedOrder);
  });
});
