export function parsePlaybackSeason(title: string) {
  const normalizedTitle = title.trim();

  if (!normalizedTitle) {
    return 1;
  }

  const seasonPatterns = [
    /(?:第\s*)?([0-9一二三四五六七八九十百千]+)\s*季/i,
    /\bS(?:eason)?\s*0*(\d{1,2})\b/i,
    /\bSeason\s*0*(\d{1,2})\b/i,
  ] as const;

  for (const pattern of seasonPatterns) {
    const match = normalizedTitle.match(pattern);

    if (!match?.[1]) {
      continue;
    }

    const parsedSeason = parseChineseSeasonNumber(match[1]);

    if (Number.isFinite(parsedSeason) && parsedSeason > 0) {
      return parsedSeason;
    }
  }

  return 1;
}

export function buildPlaybackDanmakuKeyword(title: string) {
  const normalizedTitle = title.trim();

  if (!normalizedTitle) {
    return "";
  }

  return normalizedTitle;
}

export function createPlaybackDanmakuUrl(input: { playEpisodes: number; title: string }) {
  const title = formatPlaybackDanmakuRequestTitle(input);

  if (!title) {
    return "";
  }

  return `/api/play/danmaku?${new URLSearchParams({
    title,
    play_episodes: String(Math.max(0, Math.floor(input.playEpisodes))),
  }).toString()}`;
}

export const playbackDanmakuSegmentEndpoint = "/api/play/danmaku";

export function formatPlaybackDanmakuRequestTitle(input: { playEpisodes: number; title: string }) {
  const rawTitle = input.title.trim();

  if (hasExplicitEpisodeMarker(rawTitle)) {
    return rawTitle;
  }

  const normalizedTitle = stripPlaybackSeasonMarker(rawTitle);

  if (!normalizedTitle) {
    return "";
  }

  const season = padTwo(parsePlaybackSeason(rawTitle));
  const episode = padTwo(Math.max(0, Math.floor(input.playEpisodes)));

  return `${normalizedTitle} S${season}E${episode}`;
}

function padTwo(value: number) {
  return String(value).padStart(2, "0");
}

function stripPlaybackSeasonMarker(title: string) {
  return title
    .replace(/(?:\s*[-:：]?\s*(?:第\s*[0-9一二三四五六七八九十百千]+\s*季|S(?:eason)?\s*0*\d{1,2}|Season\s*0*\d{1,2}))\s*$/i, "")
    .trim();
}

function hasExplicitEpisodeMarker(title: string) {
  return /(?:\s|^)S\d{2}E\d{2}$/i.test(title);
}

function parseChineseSeasonNumber(value: string) {
  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  const digitMap: Record<string, number> = {
    零: 0,
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };

  if (value === "十") {
    return 10;
  }

  const normalizedValue = value.replace(/两/g, "二");

  if (normalizedValue.includes("十")) {
    const [prefix, suffix] = normalizedValue.split("十");
    const tens = prefix ? digitMap[prefix] ?? Number.NaN : 1;
    const ones = suffix ? digitMap[suffix] ?? Number.NaN : 0;

    if (Number.isFinite(tens) && Number.isFinite(ones)) {
      return tens * 10 + ones;
    }
  }

  const singleDigit = digitMap[normalizedValue];
  return typeof singleDigit === "number" ? singleDigit : Number.NaN;
}
