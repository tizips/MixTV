import type { HomepageConfig as AdminHomepageConfig } from "@/modules/admin/server/homepage-modules-service";
import type { HomepageConfig } from "@/modules/homepage";
import { mapBooleanConfig } from "./boolean-config";

const homepageModuleMapping = {
  showContinueWatching: "continue-watching",
  showHeroBanner: "carousel",
  showHotMovies: "trending-movies",
  showHotShortDramas: "trending-short-dramas",
  showHotTvShows: "trending-series",
  showHotVariety: "trending-variety",
  showNewAnime: "new-anime",
  showUpcomingReleases: "coming-soon",
  showWelcomeBanner: "welcome-announcement",
} as const satisfies Record<keyof HomepageConfig, keyof AdminHomepageConfig["modules"]>;

export function mapAdminHomepageConfig(config: AdminHomepageConfig): HomepageConfig {
  return mapBooleanConfig(config.modules, homepageModuleMapping);
}
