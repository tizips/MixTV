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
  original_title: string;
  index: string;
  play_episodes: number;
  cover_default: string;
  cover: string;
  progress_id: string;
  progress_source: string;
  play_time?: number;
  is_favorite?: boolean;
  year: string;
  area: string;
  category: string;
  rating: string;
  source_name: string;
  description: string;
  tags: string[];
  episodes: Episode[];
  sources: VideoSource[];
};
