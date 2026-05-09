// src/integrations/tmdb/tmdb-adapter.ts
export type TmdbMovieDto = {
  id: number;
  title: string;
  overview: string;
};

export type NormalizedTitle = {
  source: "tmdb";
  contentId: string;
  name: string;
  summary: string;
};

export const normalizeTmdbMovie = (input: TmdbMovieDto): NormalizedTitle => ({
  source: "tmdb",
  contentId: String(input.id),
  name: input.title,
  summary: input.overview,
});
