import { describe, expect, it } from "vitest";
import { mapAdminHomepageConfig } from "./homepage";

describe("mapAdminHomepageConfig", () => {
  it("maps admin module flags to homepage flags", () => {
    const result = mapAdminHomepageConfig({
      modules: {
        carousel: false,
        "coming-soon": false,
        "continue-watching": true,
        "new-anime": true,
        "trending-movies": false,
        "trending-series": true,
        "trending-short-dramas": false,
        "trending-variety": true,
        "welcome-announcement": false,
      },
      updatedAt: null,
    });

    expect(result).toEqual({
      showContinueWatching: true,
      showHeroBanner: false,
      showHotMovies: false,
      showHotShortDramas: false,
      showHotTvShows: true,
      showHotVariety: true,
      showNewAnime: true,
      showUpcomingReleases: false,
      showWelcomeBanner: false,
    });
  });
});
