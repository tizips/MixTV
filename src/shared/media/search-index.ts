export interface MediaSearchIndexInput {
  className?: string;
  title: string;
  typeName?: string;
  year: string;
}

const yearPattern = /\d{4}/;

function normalizeSearchTitle(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[：:]/g, " ")
    .replace(/\s+/g, "");
}

function normalizeYear(year: string) {
  const match = year.trim().match(yearPattern);
  return match?.[0] ?? "unknown";
}

function normalizeTypeToken(type: string) {
  const normalized = type.trim().toLowerCase();

  if (!normalized) {
    return "unknown";
  }

  if (/^(movie|film|feature)$/.test(normalized)) {
    return "movie";
  }

  if (/^(tv|series|show|drama)$/.test(normalized)) {
    return "tv";
  }

  if (/^(anime|animation)$/.test(normalized)) {
    return "anime";
  }

  if (/^(variety|reality|entertainment)$/.test(normalized)) {
    return "variety";
  }

  if (/^(documentary|doc)$/.test(normalized)) {
    return "documentary";
  }

  if (/^(short|shortdrama)$/.test(normalized)) {
    return "shortdrama";
  }

  return normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

export function normalizeMediaSearchType(input?: string) {
  if (!input) {
    return "unknown";
  }

  const normalized = input.trim().toLowerCase();

  if (!normalized) {
    return "unknown";
  }

  if (/电影|影片|影视|片/.test(normalized)) {
    return "movie";
  }

  if (/电视剧|剧集|连续剧|连续|剧/.test(normalized)) {
    return "tv";
  }

  if (/动漫|动画|番剧|番/.test(normalized)) {
    return "anime";
  }

  if (/综艺|真人秀/.test(normalized)) {
    return "variety";
  }

  if (/纪录片/.test(normalized)) {
    return "documentary";
  }

  if (/短剧|短片/.test(normalized)) {
    return "shortdrama";
  }

  return normalizeTypeToken(normalized);
}

export function createMediaSearchIndex(input: MediaSearchIndexInput) {
  const year = normalizeYear(input.year);
  const type = normalizeMediaSearchType(input.typeName || input.className);
  const title = normalizeSearchTitle(input.title);

  return `${year}:${type}:${title}`;
}
