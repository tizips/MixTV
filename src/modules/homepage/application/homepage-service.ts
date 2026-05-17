import type { HomepageConfig } from "../domain/homepage-config";
import { defaultHomepageConfig } from "../domain/homepage-config";
import type { ContentItem, HeroItem } from "../domain/content-types";
import type { HomepageSectionKey } from "../domain/section-types";
import { getMockHomepageData, type MockHomepageData } from "./mock-data-provider";

export type HomepageData = {
  heroBanner: HeroItem[];
  showWelcomeBanner: boolean;
  sections: Array<{
    key: HomepageSectionKey;
    title: string;
    icon: string;
    iconClass: string;
    moreLink?: string;
    items: ContentItem[];
  }>;
};

type SectionConfig = {
  key: HomepageSectionKey;
  title: string;
  icon: string;
  iconClass: string;
  moreLink?: string;
  configKey: keyof HomepageConfig;
};

export const sectionConfigs: SectionConfig[] = [
  {
    key: "continueWatching",
    title: "继续观看",
    icon: "bi-play-circle-fill",
    iconClass: "text-danger",
    configKey: "showContinueWatching",
  },
  {
    key: "upcomingReleases",
    title: "即将上线",
    icon: "bi-calendar-event-fill",
    iconClass: "text-warning",
    moreLink: "/upcoming",
    configKey: "showUpcomingReleases",
  },
  {
    key: "hotMovies",
    title: "热门电影",
    icon: "bi-film",
    iconClass: "text-accent",
    moreLink: "/movies",
    configKey: "showHotMovies",
  },
  {
    key: "hotTvShows",
    title: "热门剧集",
    icon: "bi-tv-fill",
    iconClass: "text-accent",
    moreLink: "/tv",
    configKey: "showHotTvShows",
  },
  {
    key: "newAnime",
    title: "新番动漫",
    icon: "bi-play-btn-fill",
    iconClass: "text-accent",
    moreLink: "/anime",
    configKey: "showNewAnime",
  },
  {
    key: "hotVariety",
    title: "热门综艺",
    icon: "bi-stars",
    iconClass: "text-success",
    moreLink: "/variety",
    configKey: "showHotVariety",
  },
  {
    key: "hotShortDramas",
    title: "热门短剧",
    icon: "bi-phone-fill",
    iconClass: "text-warning",
    moreLink: "/shortdramas",
    configKey: "showHotShortDramas",
  },
];

export async function getHomepageData(
  config: HomepageConfig = defaultHomepageConfig,
  dataProvider?: () => MockHomepageData
): Promise<HomepageData> {
  const mockData = dataProvider ? dataProvider() : getMockHomepageData();

  // Keep continue-watching available so the client can hydrate it from history.
  const sections = sectionConfigs
    .filter((sectionConfig) => {
      if (!config[sectionConfig.configKey]) {
        return false;
      }

      if (sectionConfig.key === "continueWatching") {
        return true;
      }

      const items = mockData[sectionConfig.key] as ContentItem[];
      return items && items.length > 0;
    })
    .map((sectionConfig) => ({
      key: sectionConfig.key,
      title: sectionConfig.title,
      icon: sectionConfig.icon,
      iconClass: sectionConfig.iconClass,
      moreLink: sectionConfig.moreLink,
      items: mockData[sectionConfig.key] as ContentItem[],
    }));

  return {
    heroBanner: config.showHeroBanner ? mockData.heroBanner : [],
    showWelcomeBanner: config.showWelcomeBanner,
    sections,
  };
}
