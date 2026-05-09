export type HomepageConfig = {
  showHeroBanner: boolean;
  showContinueWatching: boolean;
  showUpcomingReleases: boolean;
  showHotMovies: boolean;
  showHotTvShows: boolean;
  showNewAnime: boolean;
  showHotVariety: boolean;
  showHotShortDramas: boolean;
};

export const defaultHomepageConfig: HomepageConfig = {
  showHeroBanner: true,
  showContinueWatching: true,
  showUpcomingReleases: true,
  showHotMovies: true,
  showHotTvShows: true,
  showNewAnime: true,
  showHotVariety: true,
  showHotShortDramas: true,
};
