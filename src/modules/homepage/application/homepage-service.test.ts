import { describe, expect, it } from "vitest";
import { defaultHomepageConfig } from "../domain/homepage-config";
import { homepageSectionOrder } from "../domain/section-types";
import { getHomepageData, sectionConfigs } from "./homepage-service";

describe("getHomepageData", () => {
  it("returns the welcome banner toggle from config", async () => {
    const enabled = await getHomepageData(defaultHomepageConfig);
    const disabled = await getHomepageData({
      ...defaultHomepageConfig,
      showWelcomeBanner: false,
    });

    expect(enabled.showWelcomeBanner).toBe(true);
    expect(disabled.showWelcomeBanner).toBe(false);
  });

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
    // Create mock data with some empty sections
    const mockDataWithEmptySections = {
      heroBanner: [],
      continueWatching: [{ id: "1", title: "Test", coverUrl: "", rating: 8, year: 2024, type: "movie" as const }],
      upcomingReleases: [], // Empty
      hotMovies: [{ id: "2", title: "Test Movie", coverUrl: "", rating: 7, year: 2024, type: "movie" as const }],
      hotTvShows: [], // Empty
      newAnime: [{ id: "3", title: "Test Anime", coverUrl: "", rating: 9, year: 2024, type: "anime" as const }],
      hotVariety: [], // Empty
      hotShortDramas: [{ id: "4", title: "Test Drama", coverUrl: "", rating: 8, year: 2024, type: "shortdrama" as const }],
    };

    const data = await getHomepageData(defaultHomepageConfig, () => mockDataWithEmptySections);
    
    const sectionKeys = data.sections.map((section) => section.key);
    
    // Should include sections with items
    expect(sectionKeys).toContain("continueWatching");
    expect(sectionKeys).toContain("hotMovies");
    expect(sectionKeys).toContain("newAnime");
    expect(sectionKeys).toContain("hotShortDramas");
    
    // Should NOT include empty sections
    expect(sectionKeys).not.toContain("upcomingReleases");
    expect(sectionKeys).not.toContain("hotTvShows");
    expect(sectionKeys).not.toContain("hotVariety");
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
      actualOrder.includes(key as (typeof actualOrder)[number]),
    );
    
    expect(actualOrder).toEqual(filteredExpectedOrder);
  });

  it("sectionConfigs order matches homepageSectionOrder from domain", () => {
    // Extract keys from sectionConfigs
    const configKeys = sectionConfigs.map((config) => config.key);
    
    // Filter homepageSectionOrder to exclude heroBanner (not in sectionConfigs)
    const domainOrderWithoutHero = homepageSectionOrder.filter(
      (key) => key !== "heroBanner"
    );
    
    // Verify the order matches
    expect(configKeys).toEqual(domainOrderWithoutHero);
  });
});
