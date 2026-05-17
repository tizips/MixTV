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

  it("keeps continue watching available without placeholder items", async () => {
    const mockDataWithEmptySections = {
      heroBanner: [],
      continueWatching: [],
      upcomingReleases: [],
      hotMovies: [{ id: "2", title: "Test Movie", coverUrl: "", rating: 7, year: 2024, type: "movie" as const }],
      hotTvShows: [],
      newAnime: [{ id: "3", title: "Test Anime", coverUrl: "", rating: 9, year: 2024, type: "anime" as const }],
      hotVariety: [],
      hotShortDramas: [{ id: "4", title: "Test Drama", coverUrl: "", rating: 8, year: 2024, type: "shortdrama" as const }],
    };

    const data = await getHomepageData(defaultHomepageConfig, () => mockDataWithEmptySections);
    const sectionKeys = data.sections.map((section) => section.key);

    expect(sectionKeys).toContain("continueWatching");
    expect(sectionKeys).toContain("hotMovies");
    expect(sectionKeys).toContain("newAnime");
    expect(sectionKeys).toContain("hotShortDramas");

    const continueWatchingSection = data.sections.find((section) => section.key === "continueWatching");

    expect(continueWatchingSection?.items).toEqual([]);
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

    const filteredExpectedOrder = expectedOrder.filter((key) =>
      actualOrder.includes(key as (typeof actualOrder)[number]),
    );

    expect(actualOrder).toEqual(filteredExpectedOrder);
  });

  it("sectionConfigs order matches homepageSectionOrder from domain", () => {
    const configKeys = sectionConfigs.map((config) => config.key);

    const domainOrderWithoutHero = homepageSectionOrder.filter(
      (key) => key !== "heroBanner",
    );

    expect(configKeys).toEqual(domainOrderWithoutHero);
  });
});
