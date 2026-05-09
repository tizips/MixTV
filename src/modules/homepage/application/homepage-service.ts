import type { HomepageConfig } from "../domain/homepage-config";
import { defaultHomepageConfig } from "../domain/homepage-config";
import type { ContentItem, HeroItem } from "../domain/content-types";
import type { HomepageSectionKey } from "../domain/section-types";
import { homepageSectionOrder } from "../domain/section-types";
import { getMockHomepageData, type MockHomepageData } from "./mock-data-provider";

export type HomepageData = {
  heroBanner: HeroItem[];
  sections: Array<{
    key: HomepageSectionKey;
    title: string;
    moreLink?: string;
    items: ContentItem[];
  }>;
};

type SectionConfig = {
  key: HomepageSectionKey;
  title: string;
  moreLink?: string;
  configKey: keyof HomepageConfig;
};

export const sectionConfigs: SectionConfig[] = [
  {
    key: "continueWatching",
    title: "继续观看",
    configKey: "showContinueWatching",
  },
  {
    key: "upcomingReleases",
    title: "即将上线",
    moreLink: "/upcoming",
    configKey: "showUpcomingReleases",
  },
  {
    key: "hotMovies",
    title: "热门电影",
    moreLink: "/movies",
    configKey: "showHotMovies",
  },
  {
    key: "hotTvShows",
    title: "热门剧集",
    moreLink: "/tv",
    configKey: "showHotTvShows",
  },
  {
    key: "newAnime",
    title: "新番动漫",
    moreLink: "/anime",
    configKey: "showNewAnime",
  },
  {
    key: "hotVariety",
    title: "热门综艺",
    moreLink: "/variety",
    configKey: "showHotVariety",
  },
  {
    key: "hotShortDramas",
    title: "热门短剧",
    moreLink: "/shortdramas",
    configKey: "showHotShortDramas",
  },
];

export async function getHomepageData(
  config: HomepageConfig = defaultHomepageConfig,
  dataProvider?: () => MockHomepageData
): Promise<HomepageData> {
  const mockData = dataProvider ? dataProvider() : getMockHomepageData();

  // Filter sections based on config and non-empty items
  const sections = sectionConfigs
    .filter((sectionConfig) => {
      // Check if section is enabled in config
      if (!config[sectionConfig.configKey]) {
        return false;
      }

      // Check if section has items
      const items = mockData[sectionConfig.key] as ContentItem[];
      return items && items.length > 0;
    })
    .map((sectionConfig) => ({
      key: sectionConfig.key,
      title: sectionConfig.title,
      moreLink: sectionConfig.moreLink,
      items: mockData[sectionConfig.key] as ContentItem[],
    }));

  return {
    heroBanner: config.showHeroBanner ? mockData.heroBanner : [],
    sections,
  };
}
