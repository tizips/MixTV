import { getDanmakuConfig } from "@/modules/admin";
import {
  buildPlaybackDanmakuKeyword,
  formatPlaybackDanmakuRequestTitle,
  parsePlaybackSeason,
} from "../domain/playback-danmaku";

export interface PlaybackDanmakuRequest {
  title?: string | string[];
  play_episodes?: string | string[] | number;
}

export interface PlaybackDanmakuServiceOptions {
  fetcher?: typeof fetch;
}

export type PlaybackDanmakuItem = {
  color?: string;
  mode?: 0 | 1 | 2;
  text: string;
  time: number;
};

const jsonResponseHeaders = {
  "Cache-Control": "no-cache, no-transform",
  "Content-Type": "application/json; charset=utf-8",
};

function readSingleParam(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue?.trim() || "";
}

function readEpisodeNumber(value: string | string[] | number | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (typeof rawValue === "number") {
    return Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 1;
  }

  if (typeof rawValue === "string" && rawValue.trim()) {
    const parsed = Number(rawValue);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 1;
}

function createEndpointUrl(apiUrl: string, apiToken: string, path: string) {
  const normalizedBaseUrl = apiUrl.trim().replace(/\/+$/, "");
  const normalizedToken = apiToken.trim();
  return new URL(`${normalizedBaseUrl}/${encodeURIComponent(normalizedToken)}${path}`);
}

function readJsonObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readJsonArray(value: unknown) {
  return Array.isArray(value) ? value : null;
}

function extractEpisodeId(payload: unknown): string {
  const record = readJsonObject(payload);

  if (!record) {
    return "";
  }

  if (record.isMatched !== true) {
    return "";
  }

  const matches = readJsonArray(record.matches);
  const firstMatch = matches?.[0];

  if (!firstMatch || typeof firstMatch !== "object" || Array.isArray(firstMatch)) {
    return "";
  }

  const episodeId = (firstMatch as Record<string, unknown>).episodeId;

  if (typeof episodeId === "string" && episodeId.trim()) {
    return episodeId.trim();
  }

  if (typeof episodeId === "number" && Number.isFinite(episodeId)) {
    return String(episodeId);
  }

  return "";
}

function normalizeMode(value: unknown): 0 | 1 | 2 {
  if (value === 0 || value === "0" || value === "scroll" || value === "Scroll") {
    return 0;
  }

  if (value === 1 || value === "1" || value === "top" || value === "Top") {
    return 1;
  }

  if (value === 2 || value === "2" || value === "bottom" || value === "Bottom") {
    return 2;
  }

  if (value === 4 || value === "4") {
    return 2;
  }

  if (value === 5 || value === "5") {
    return 1;
  }

  return 0;
}

function normalizeColor(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return `#${Math.max(0, Math.min(0xffffff, Math.floor(value))).toString(16).padStart(6, "0")}`;
  }

  return undefined;
}

function extractTime(item: Record<string, unknown>) {
  const candidates = [item.time, item.progress, item.currentTime, item.t, item.seconds];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0) {
      return candidate;
    }

    if (typeof candidate === "string" && candidate.trim()) {
      const parsed = Number(candidate);

      if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed;
      }
    }
  }

  return null;
}

function extractText(item: Record<string, unknown>) {
  const candidates = [item.text, item.content, item.message, item.body, item.m];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
}

function extractComments(payload: unknown) {
  const record = readJsonObject(payload);

  if (record) {
    for (const key of ["comments", "data", "items", "danmaku", "danmus"] as const) {
      const comments = readJsonArray(record[key]);

      if (comments) {
        return comments;
      }
    }
  }

  return readJsonArray(payload) ?? [];
}

function extractDanmakuItems(payload: unknown): PlaybackDanmakuItem[] {
  const comments = extractComments(payload);
  const result: PlaybackDanmakuItem[] = [];

  for (const comment of comments) {
    if (!comment || typeof comment !== "object" || Array.isArray(comment)) {
      continue;
    }

    const item = comment as Record<string, unknown>;
    const text = extractText(item);
    const time = extractTime(item);

    if (!text || time === null) {
      continue;
    }

    const danmakuItem: PlaybackDanmakuItem = {
      text,
      time,
    };

    const mode = normalizeMode(item.mode ?? item.type ?? item.position);
    if (Number.isFinite(mode)) {
      danmakuItem.mode = mode;
    }

    const color = normalizeColor(item.color ?? item.colour);
    if (color) {
      danmakuItem.color = color;
    }

    result.push(danmakuItem);
  }

  return result;
}

async function fetchJson(fetcher: typeof fetch, url: URL, init?: RequestInit) {
  const response = await fetcher(url, init);
  const text = await response.text();

  if (!text.trim()) {
    return { payload: null, response, text };
  }

  try {
    return { payload: JSON.parse(text) as unknown, response, text };
  } catch {
    return { payload: null, response, text };
  }
}

export async function getPlaybackDanmaku(request: PlaybackDanmakuRequest, options: PlaybackDanmakuServiceOptions = {}) {
  const title = readSingleParam(request.title);
  const playEpisodes = readEpisodeNumber(request.play_episodes);
  const requestTitle = formatPlaybackDanmakuRequestTitle({ playEpisodes, title });

  if (!requestTitle) {
    return [];
  }

  const danmakuConfig = await getDanmakuConfig();

  if (!danmakuConfig.enabled) {
    return [];
  }

  const fetcher = options.fetcher ?? fetch;
  const matchUrl = createEndpointUrl(danmakuConfig.apiUrl, danmakuConfig.apiToken, "/api/v2/match");

  try {
    const { payload: matchPayload, response: matchResponse, text: matchText } = await fetchJson(fetcher, matchUrl, {
      body: JSON.stringify({ fileName: requestTitle }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!matchResponse.ok || !matchPayload) {
      return [];
    }

    const episodeId = extractEpisodeId(matchPayload);

    if (!episodeId) {
      return [];
    }

    const commentUrl = createEndpointUrl(
      danmakuConfig.apiUrl,
      danmakuConfig.apiToken,
      `/api/v2/comment/${encodeURIComponent(episodeId)}`,
    );
    commentUrl.searchParams.set("format", "json");
    commentUrl.searchParams.set("duration", "true");

    const { payload: commentPayload, response: commentResponse, text: commentText } = await fetchJson(fetcher, commentUrl, {
      headers: {
        Accept: "application/json",
      },
      method: "GET",
    });

    if (!commentResponse.ok || !commentPayload) {
      return [];
    }

    return extractDanmakuItems(commentPayload);
  } catch {
    return [];
  }
}

export function createPlaybackDanmakuApiResponse(danmaku: PlaybackDanmakuItem[]) {
  return new Response(JSON.stringify(danmaku), {
    headers: jsonResponseHeaders,
    status: 200,
  });
}

export function createPlaybackDanmakuDebugInfo(title: string) {
  return {
    season: parsePlaybackSeason(title),
    keyword: buildPlaybackDanmakuKeyword(title),
  };
}
