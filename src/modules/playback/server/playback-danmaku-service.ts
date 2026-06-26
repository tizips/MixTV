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

export type PlaybackDanmakuLoadMode = "full" | "segment";

export interface PlaybackDanmakuSegment {
  start: number;
  end: number;
  url: string;
  type: string;
  data?: string;
  mH5Tk?: string;
  mH5TkEnc?: string;
}

export interface PlaybackDanmakuResult {
  loadMode: PlaybackDanmakuLoadMode;
  items: PlaybackDanmakuItem[];
  segments: PlaybackDanmakuSegment[];
  episodeId: string;
}

export interface PlaybackDanmakuSegmentRequest {
  segment: PlaybackDanmakuSegment;
}

const emptyDanmakuResult: PlaybackDanmakuResult = {
  loadMode: "full",
  items: [],
  segments: [],
  episodeId: "",
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

function readSegmentNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return 0;
}

function extractSegments(payload: unknown): PlaybackDanmakuSegment[] {
  const record = readJsonObject(payload);

  if (!record) {
    return [];
  }

  // 上游 segmentflag 响应结构：{ comments: { segmentList: [...], type, duration } }
  // 兼容 segmentList 直接挂在顶层或 comments 字段下的两种形态。
  const container = readJsonObject(record.comments) ?? record;
  const segmentList = readJsonArray(container.segmentList);

  if (!segmentList) {
    return [];
  }

  const fallbackType = typeof container.type === "string" ? container.type : "";
  const result: PlaybackDanmakuSegment[] = [];

  for (const entry of segmentList) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }

    const segment = entry as Record<string, unknown>;
    const url = typeof segment.url === "string" ? segment.url.trim() : "";

    if (!url) {
      continue;
    }

    const type = typeof segment.type === "string" && segment.type.trim()
      ? segment.type.trim()
      : fallbackType;

    const extracted: PlaybackDanmakuSegment = {
      start: readSegmentNumber(segment.segment_start),
      end: readSegmentNumber(segment.segment_end),
      url,
      type,
    };

    if (typeof segment.data === "string") {
      extracted.data = segment.data;
    }

    if (typeof segment._m_h5_tk === "string") {
      extracted.mH5Tk = segment._m_h5_tk;
    }

    if (typeof segment._m_h5_tk_enc === "string") {
      extracted.mH5TkEnc = segment._m_h5_tk_enc;
    }

    result.push(extracted);
  }

  return result;
}

async function fetchJson(fetcher: typeof fetch, url: URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher(url, { ...init, signal: controller.signal });
    const text = await response.text();

    if (!text.trim()) {
      return { payload: null, response, text };
    }

    try {
      return { payload: JSON.parse(text) as unknown, response, text };
    } catch {
      return { payload: null, response, text };
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function getPlaybackDanmaku(request: PlaybackDanmakuRequest, options: PlaybackDanmakuServiceOptions = {}): Promise<PlaybackDanmakuResult> {
  const title = readSingleParam(request.title);
  const playEpisodes = readEpisodeNumber(request.play_episodes);
  const requestTitle = formatPlaybackDanmakuRequestTitle({ playEpisodes, title });

  if (!requestTitle) {
    return emptyDanmakuResult;
  }

  const danmakuConfig = await getDanmakuConfig();

  if (!danmakuConfig.enabled) {
    return emptyDanmakuResult;
  }

  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = danmakuConfig.requestTimeoutSeconds * 1000;
  const matchUrl = createEndpointUrl(danmakuConfig.apiUrl, danmakuConfig.apiToken, "/api/v2/match");

  try {
    const { payload: matchPayload, response: matchResponse } = await fetchJson(fetcher, matchUrl, {
      body: JSON.stringify({ fileName: requestTitle }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
    }, timeoutMs);

    if (!matchResponse.ok || !matchPayload) {
      return emptyDanmakuResult;
    }

    const episodeId = extractEpisodeId(matchPayload);

    if (!episodeId) {
      return emptyDanmakuResult;
    }

    const commentUrl = createEndpointUrl(
      danmakuConfig.apiUrl,
      danmakuConfig.apiToken,
      `/api/v2/comment/${encodeURIComponent(episodeId)}`,
    );
    commentUrl.searchParams.set("format", "json");

    if (danmakuConfig.loadMode === "segment") {
      commentUrl.searchParams.set("segmentflag", "true");

      const { payload: segmentPayload, response: segmentResponse } = await fetchJson(fetcher, commentUrl, {
        headers: {
          Accept: "application/json",
        },
        method: "GET",
      }, timeoutMs);

      if (!segmentResponse.ok || !segmentPayload) {
        return { ...emptyDanmakuResult, loadMode: "segment", episodeId };
      }

      return {
        loadMode: "segment",
        items: [],
        segments: extractSegments(segmentPayload),
        episodeId,
      };
    }

    commentUrl.searchParams.set("duration", "true");

    const { payload: commentPayload, response: commentResponse } = await fetchJson(fetcher, commentUrl, {
      headers: {
        Accept: "application/json",
      },
      method: "GET",
    }, timeoutMs);

    if (!commentResponse.ok || !commentPayload) {
      return { ...emptyDanmakuResult, loadMode: "full", episodeId };
    }

    return {
      loadMode: "full",
      items: extractDanmakuItems(commentPayload),
      segments: [],
      episodeId,
    };
  } catch (error) {
    console.error("Failed to load playback danmaku.", error);
    return { ...emptyDanmakuResult, loadMode: danmakuConfig.loadMode };
  }
}

export async function getPlaybackDanmakuSegment(
  request: PlaybackDanmakuSegmentRequest,
  options: PlaybackDanmakuServiceOptions = {},
): Promise<PlaybackDanmakuItem[]> {
  const segment = request.segment;
  const url = segment.url.trim();
  const type = segment.type.trim();

  if (!url || !type) {
    return [];
  }

  const danmakuConfig = await getDanmakuConfig();

  if (!danmakuConfig.enabled) {
    return [];
  }

  // 上游 Segment.fromJson 要求 segment_start/segment_end/url/type 为必需字段，
  // data/_m_h5_tk/_m_h5_tk_enc 为可选字段（优酷分片需要 token 才能取到弹幕）。
  const upstreamSegment: Record<string, unknown> = {
    segment_start: segment.start,
    segment_end: segment.end,
    url,
    type,
  };

  if (segment.data) {
    upstreamSegment.data = segment.data;
  }

  if (segment.mH5Tk) {
    upstreamSegment._m_h5_tk = segment.mH5Tk;
  }

  if (segment.mH5TkEnc) {
    upstreamSegment._m_h5_tk_enc = segment.mH5TkEnc;
  }

  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = danmakuConfig.requestTimeoutSeconds * 1000;
  const endpointUrl = createEndpointUrl(danmakuConfig.apiUrl, danmakuConfig.apiToken, "/api/v2/segmentcomment");
  endpointUrl.searchParams.set("format", "json");

  try {
    const { payload, response } = await fetchJson(fetcher, endpointUrl, {
      body: JSON.stringify(upstreamSegment),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
    }, timeoutMs);

    if (!response.ok || !payload) {
      return [];
    }

    return extractDanmakuItems(payload);
  } catch (error) {
    console.error("Failed to load playback danmaku segment.", error);
    return [];
  }
}

export function createPlaybackDanmakuApiResponse(result: PlaybackDanmakuResult) {
  return new Response(JSON.stringify(result), {
    headers: jsonResponseHeaders,
    status: 200,
  });
}

export function createPlaybackDanmakuSegmentApiResponse(items: PlaybackDanmakuItem[]) {
  return new Response(JSON.stringify({ items }), {
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
