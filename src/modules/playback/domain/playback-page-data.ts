export type Episode = {
  number: number;
  title: string;
  duration: string;
};

export type VideoSource = {
  id: string;
  name: string;
  url: string;
  quality: string;
  latency: string;
  status: "流畅" | "拥挤" | "维护";
};

export type PlayPageData = {
  title: string;
  originalTitle: string;
  currentEpisode: number;
  posterUrl: string;
  progressId: string;
  progressSource: string;
  resumeTimeSeconds?: number;
  year: string;
  area: string;
  category: string;
  rating: string;
  sourceName: string;
  description: string;
  tags: string[];
  episodes: Episode[];
  sources: VideoSource[];
};
