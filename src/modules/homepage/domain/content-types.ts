export type ContentType = "movie" | "tv" | "anime" | "variety" | "shortdrama";

export type ContinueWatchingInfo = {
  currentEpisode: number;
  latestEpisode: number;
  sourceName: string;
};

export type ContentItem = {
  id: string;
  title: string;
  coverUrl: string;
  backdropUrl?: string;
  rating?: number;
  year?: number;
  type: ContentType;
  description?: string;
  genres?: string[];
  continueWatching?: ContinueWatchingInfo;
};

export type HeroItem = {
  id: string;
  title: string;
  description: string;
  backdropUrl: string;
  rating: number;
  trailerUrl?: string;
  type: Exclude<ContentType, "shortdrama">;
};
