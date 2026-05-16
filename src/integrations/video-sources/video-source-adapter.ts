/**
 * A configured third-party video source endpoint.
 *
 * `apiUrl` points to a standard vod provider JSON endpoint. `detailUrl` is
 * optional and enables the legacy HTML detail-page parser for sources whose
 * JSON detail endpoint does not expose playable URLs reliably.
 */
export interface VideoSourceEndpoint {
  apiUrl: string;
  detailUrl?: string;
  key: string;
  name: string;
}

/**
 * MixTV's normalized representation of one resource returned by a third-party
 * video source. The adapter keeps source identity on every result so later
 * search aggregation can group, de-duplicate, or route playback requests.
 */
export interface VideoSourceResource {
  className?: string;
  description: string;
  doubanId?: number;
  episodeTitles?: string[];
  episodes: string[];
  id: string;
  posterUrl: string;
  remarks?: string;
  quality?: string;
  sourceKey: string;
  sourceName: string;
  title: string;
  typeName?: string;
  year: string;
}

/**
 * Runtime options for adapter calls.
 *
 * `fetcher` exists primarily for tests and future server composition.
 * `variants` lets an upstream search service precompute query variants once
 * and reuse them across many sources.
 */
export interface VideoSourceAdapterOptions {
  fetcher?: VideoSourceFetch;
  maxPages?: number;
  timeoutMs?: number;
  variants?: string[];
}

type VideoSourceFetch = (input: string, init?: RequestInit) => Promise<Response>;

interface RawVideoSourceItem {
  type_name?: unknown;
  vod_class?: unknown;
  vod_content?: unknown;
  vod_douban_id?: unknown;
  vod_id?: unknown;
  vod_name?: unknown;
  vod_pic?: unknown;
  vod_play_url?: unknown;
  vod_remarks?: unknown;
  vod_year?: unknown;
}

interface RawVideoSourceListResponse {
  list?: unknown;
  pagecount?: unknown;
}

const defaultHeaders = new Headers({
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
});

const m3u8Pattern = /(https?:\/\/[^"'\s]+?\.m3u8)/g;
const chineseToArabic: Record<string, string> = {
  一: "1",
  二: "2",
  三: "3",
  四: "4",
  五: "5",
  六: "6",
  七: "7",
  八: "8",
  九: "9",
  十: "10",
};
const arabicToChinese = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

/**
 * Coerces loose third-party payload values into strings. Many vod providers
 * return IDs and years as either numbers or strings, so normalizing at the edge
 * keeps the rest of the adapter predictable.
 */
function asString(value: unknown) {
  return typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);
}

/**
 * Returns a trimmed string only when the provider supplied meaningful content.
 * Optional normalized fields use `undefined` instead of empty strings.
 */
function asOptionalString(value: unknown) {
  const text = asString(value).trim();
  return text || undefined;
}

/**
 * Parses optional numeric fields such as `vod_douban_id`.
 */
function asOptionalNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

/**
 * Removes simple HTML markup from provider descriptions. This deliberately
 * stays lightweight because the adapter only needs plain summary text, not a
 * full HTML sanitizer.
 */
function cleanHtmlTags(value: unknown) {
  return asString(value)
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractQuality(value: unknown) {
  const text = asOptionalString(value);

  if (!text) {
    return undefined;
  }

  const match = text.match(/(?:2160|4k|1080|720|480)p|蓝光|超清|高清|标清|hd|uhd/i);

  if (!match) {
    return undefined;
  }

  const label = match[0] ?? "";

  return label.length === 2 || label.length === 3 ? label.toUpperCase() : label;
}

/**
 * Extracts the first 4-digit year from provider values such as `2025-01-01`,
 * `2025`, or mixed text. Unknown or malformed values become `unknown`.
 */
function extractYear(value: unknown) {
  return asString(value).match(/\d{4}/)?.[0] ?? "unknown";
}

/**
 * Builds standard vod API URLs while preserving any existing query parameters
 * already present on the configured `apiUrl`.
 */
function createVodApiUrl(apiUrl: string, params: Record<string, string | number>) {
  const url = new URL(apiUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/**
 * Fetches JSON with an abort timeout. Non-2xx responses are treated as empty
 * provider results so one bad source does not have to break aggregate search.
 */
async function fetchJson(url: string, options: Required<Pick<VideoSourceAdapterOptions, "fetcher" | "timeoutMs">>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const fetcher = options.fetcher === fetch ? createTrackedThirdPartyFetch(fetch) : options.fetcher;
    const response = await fetcher(url, {
      headers: defaultHeaders,
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetches HTML/text detail pages with an abort timeout. Unlike search JSON,
 * detail-page failures throw because callers requested a specific item.
 */
async function fetchText(url: string, options: Required<Pick<VideoSourceAdapterOptions, "fetcher" | "timeoutMs">>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const fetcher = options.fetcher === fetch ? createTrackedThirdPartyFetch(fetch) : options.fetcher;
    const response = await fetcher(url, {
      headers: defaultHeaders,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Video source detail page request failed: ${response.status}`);
    }

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parses the common vod `vod_play_url` format:
 *
 * `title$url#title$url$$$alternateGroupTitle$url`
 *
 * Providers can expose multiple play groups separated by `$$$`. The adapter
 * keeps the group with the most playable `.m3u8` episodes, matching LunaTV's
 * practical behavior of preferring the richest playable group.
 */
function parseEpisodesFromPlayUrl(playUrl: unknown) {
  let episodes: string[] = [];
  let episodeTitles: string[] = [];

  for (const playGroup of asString(playUrl).split("$$$")) {
    const groupEpisodes: string[] = [];
    const groupTitles: string[] = [];

    for (const item of playGroup.split("#")) {
      const separatorIndex = item.indexOf("$");
      if (separatorIndex < 0) {
        continue;
      }

      const title = item.slice(0, separatorIndex).trim();
      const episodeUrl = item.slice(separatorIndex + 1).trim();

      if (episodeUrl.endsWith(".m3u8")) {
        groupTitles.push(title);
        groupEpisodes.push(episodeUrl);
      }
    }

    if (groupEpisodes.length > episodes.length) {
      episodeTitles = groupTitles;
      episodes = groupEpisodes;
    }
  }

  return { episodeTitles, episodes };
}

/**
 * Extracts fallback `.m3u8` links from description/content fields when a detail
 * response does not include a usable `vod_play_url`.
 */
function parseEpisodesFromContent(content: unknown) {
  return Array.from(new Set(asString(content).match(m3u8Pattern) ?? []));
}

/**
 * Normalizes one search-list item. Search results without an id, title, or
 * playable `.m3u8` episode are dropped because the playback module would not be
 * able to route or play them deterministically.
 */
function normalizeVideoSourceItem(source: VideoSourceEndpoint, item: RawVideoSourceItem): VideoSourceResource | null {
  const id = asString(item.vod_id).trim();
  const title = asString(item.vod_name).trim().replace(/\s+/g, " ");
  const { episodeTitles, episodes } = parseEpisodesFromPlayUrl(item.vod_play_url);

  if (!id || !title || episodes.length === 0) {
    return null;
  }

  return {
    className: asOptionalString(item.vod_class),
    description: cleanHtmlTags(item.vod_content),
    doubanId: asOptionalNumber(item.vod_douban_id),
    episodeTitles,
    episodes,
    id,
    posterUrl: asString(item.vod_pic).trim(),
    remarks: asOptionalString(item.vod_remarks),
    quality: extractQuality(item.vod_remarks),
    sourceKey: source.key,
    sourceName: source.name,
    title,
    typeName: asOptionalString(item.type_name),
    year: extractYear(item.vod_year),
  };
}

/**
 * Normalizes a detail response item. Detail lookup is allowed to keep fallback
 * content-extracted `.m3u8` links because it targets a known item and often has
 * richer provider fields than search responses.
 */
function normalizeVideoSourceDetail(source: VideoSourceEndpoint, id: string, item: RawVideoSourceItem): VideoSourceResource {
  const playUrlEpisodes = parseEpisodesFromPlayUrl(item.vod_play_url);
  const fallbackEpisodes = playUrlEpisodes.episodes.length > 0 ? [] : parseEpisodesFromContent(item.vod_content);

  return {
    className: asOptionalString(item.vod_class),
    description: cleanHtmlTags(item.vod_content),
    doubanId: asOptionalNumber(item.vod_douban_id),
    episodeTitles: playUrlEpisodes.episodeTitles,
    episodes: playUrlEpisodes.episodes.length > 0 ? playUrlEpisodes.episodes : fallbackEpisodes,
    id,
    posterUrl: asString(item.vod_pic).trim(),
    remarks: asOptionalString(item.vod_remarks),
    quality: extractQuality(item.vod_remarks),
    sourceKey: source.key,
    sourceName: source.name,
    title: asString(item.vod_name).trim().replace(/\s+/g, " "),
    typeName: asOptionalString(item.type_name),
    year: extractYear(item.vod_year),
  };
}

/**
 * Safely narrows arbitrary JSON to the loose list-response shape used by vod
 * providers. Malformed payloads become an empty response object.
 */
function readListResponse(value: unknown): RawVideoSourceListResponse {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RawVideoSourceListResponse) : {};
}

/**
 * Searches a single page of a single video source using the standard vod
 * `ac=videolist` protocol and normalizes the returned list.
 */
async function searchVideoSourcePage(
  source: VideoSourceEndpoint,
  query: string,
  page: number,
  options: Required<Pick<VideoSourceAdapterOptions, "fetcher" | "timeoutMs">>,
) {
  const url = createVodApiUrl(source.apiUrl, page === 1 ? { ac: "videolist", wd: query } : { ac: "videolist", wd: query, pg: page });
  const payload = readListResponse(await fetchJson(url, options));
  const rawList = Array.isArray(payload.list) ? payload.list : [];
  const results = rawList
    .map((item) => normalizeVideoSourceItem(source, item as RawVideoSourceItem))
    .filter((item): item is VideoSourceResource => item !== null);

  return {
    pageCount: typeof payload.pagecount === "number" ? payload.pagecount : Number(payload.pagecount) || 1,
    results,
  };
}

/**
 * Searches one third-party video source and returns normalized playable
 * resources.
 *
 * The function searches all query variants on page 1, de-duplicates by
 * `{sourceKey}:{id}`, then fetches additional pages for the primary variant up
 * to `maxPages`. It does not know about user permissions, adult filtering,
 * source enablement, caching, or API response formatting; those belong to a
 * server module that composes this integration.
 */
export async function searchVideoSource(
  source: VideoSourceEndpoint,
  query: string,
  {
    fetcher = fetch,
    maxPages = 5,
    timeoutMs = 8_000,
    variants = generateVideoSourceSearchVariants(query),
  }: VideoSourceAdapterOptions = {},
) {
  const normalizedVariants = Array.from(new Set(variants.map((variant) => variant.trim()).filter(Boolean)));
  const seen = new Set<string>();
  const results: VideoSourceResource[] = [];
  let pageCount = 1;

  for (const [index, variant] of normalizedVariants.entries()) {
    const page = await searchVideoSourcePage(source, variant, 1, { fetcher, timeoutMs });

    if (index === 0) {
      pageCount = page.pageCount;
    }

    for (const result of page.results) {
      const key = `${result.sourceKey}:${result.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push(result);
      }
    }
  }

  const pagesToFetch = Math.min(Math.max(pageCount - 1, 0), Math.max(maxPages - 1, 0));
  const primaryVariant = normalizedVariants[0] ?? query.trim();

  for (let page = 2; page <= pagesToFetch + 1; page += 1) {
    const pageResult = await searchVideoSourcePage(source, primaryVariant, page, { fetcher, timeoutMs });
    for (const result of pageResult.results) {
      const key = `${result.sourceKey}:${result.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push(result);
      }
    }
  }

  return results;
}

/**
 * Fetches detail for one resource from a third-party source.
 *
 * Sources with `detailUrl` use the optional HTML parser. Other sources use the
 * standard JSON `ids` endpoint. The returned shape is the same
 * `VideoSourceResource` used by search so callers can handle search and detail
 * data uniformly.
 */
export async function getVideoSourceDetail(
  source: VideoSourceEndpoint,
  id: string,
  { fetcher = fetch, timeoutMs = 10_000 }: Pick<VideoSourceAdapterOptions, "fetcher" | "timeoutMs"> = {},
) {
  if (source.detailUrl) {
    return getVideoSourceHtmlDetail(source, id, { fetcher, timeoutMs });
  }

  const url = createVodApiUrl(source.apiUrl, { ac: "videolist", ids: id });
  const payload = readListResponse(await fetchJson(url, { fetcher, timeoutMs }));
  const rawList = Array.isArray(payload.list) ? payload.list : [];
  const detail = rawList[0] as RawVideoSourceItem | undefined;

  if (!detail) {
    throw new Error("Video source detail response is empty.");
  }

  return normalizeVideoSourceDetail(source, id, detail);
}

/**
 * Parses legacy HTML detail pages for sources that cannot provide usable JSON
 * details. The parser intentionally extracts only the minimum fields needed by
 * MixTV: title, sketch/description, poster, year, and `.m3u8` links.
 */
async function getVideoSourceHtmlDetail(
  source: VideoSourceEndpoint,
  id: string,
  options: Required<Pick<VideoSourceAdapterOptions, "fetcher" | "timeoutMs">>,
) {
  const baseUrl = source.detailUrl?.replace(/\/+$/, "");
  const html = await fetchText(`${baseUrl}/index.php/vod/detail/id/${encodeURIComponent(id)}.html`, options);
  const episodes = Array.from(new Set((html.match(/\$(https?:\/\/[^"'\s#]+?\.m3u8)/g) ?? []).map((link) => link.slice(1))));
  const title = html.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1]?.trim() ?? "";
  const sketch = html.match(/<div[^>]*class=["']sketch["'][^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "";
  const posterUrl = html.match(/https?:\/\/[^"'\s]+?\.jpg/)?.[0]?.trim() ?? "";
  const year = html.match(/>(\d{4})</)?.[1] ?? "unknown";

  return {
    className: undefined,
    description: cleanHtmlTags(sketch),
    doubanId: undefined,
    episodeTitles: episodes.map((_, index) => String(index + 1)),
    episodes,
    id,
    posterUrl,
    remarks: undefined,
    sourceKey: source.key,
    sourceName: source.name,
    title,
    typeName: undefined,
    year,
    quality: undefined,
  };
}

/**
 * Generates a small set of focused query variants for vod providers.
 *
 * The goal is to catch common provider indexing differences without fanning out
 * into expensive broad searches: season numbers, colon punctuation, book-title
 * brackets, and simple whitespace differences. Traditional/simplified Chinese
 * conversion is intentionally excluded until the project adopts a converter
 * dependency.
 */
export function generateVideoSourceSearchVariants(originalQuery: string) {
  const trimmed = originalQuery.trim();
  if (!trimmed) {
    return [];
  }

  const variants = [trimmed];
  const numberVariant = generateNumberVariant(trimmed);
  const punctuationVariant = generatePunctuationVariant(trimmed);

  if (numberVariant) {
    variants.push(numberVariant);
  } else if (punctuationVariant) {
    variants.push(punctuationVariant);
  } else if (trimmed.includes(" ")) {
    const keywords = trimmed.split(/\s+/);
    if (keywords.length >= 2) {
      const lastKeyword = keywords[keywords.length - 1] ?? "";
      variants.push(/第|季|集|部|篇|章/.test(lastKeyword) ? `${keywords[0]}${lastKeyword}` : trimmed.replace(/\s+/g, ""));
    }
  }

  return Array.from(new Set(variants));
}

/**
 * Converts common season/part/episode number forms between Arabic and Chinese
 * numerals. Returns `null` when the query does not contain a narrow pattern we
 * know how to improve.
 */
function generateNumberVariant(query: string) {
  const chineseMatch = /第([一二三四五六七八九十])(季|部|集|期)/.exec(query);
  if (chineseMatch) {
    const base = query.replace(chineseMatch[0], "").trim();
    const arabic = chineseToArabic[chineseMatch[1] ?? ""];
    return base && arabic ? `${base}${arabic}` : null;
  }

  const arabicMatch = /第(\d+)(季|部|集|期)/.exec(query);
  if (arabicMatch) {
    const number = Number(arabicMatch[1]);
    const chinese = number >= 1 && number <= 10 ? arabicToChinese[number] : undefined;
    return chinese ? query.replace(arabicMatch[0], `第${chinese}${arabicMatch[2]}`) : null;
  }

  const endNumberMatch = /^(.+?)(\d+)$/.exec(query);
  if (endNumberMatch) {
    const number = Number(endNumberMatch[2]);
    const chinese = number >= 1 && number <= 10 ? arabicToChinese[number] : undefined;
    return chinese ? `${endNumberMatch[1]?.trim()}第${chinese}季` : null;
  }

  return null;
}

/**
 * Generates one punctuation-focused variant for common title separators used by
 * Chinese vod providers.
 */
function generatePunctuationVariant(query: string) {
  if (query.includes("：")) {
    return query.replace(/：/g, " ");
  }
  if (query.includes(":")) {
    return query.replace(/:/g, " ");
  }
  if (query.includes("《") || query.includes("》")) {
    return query.replace(/[《》]/g, "");
  }
  return null;
}
import { createTrackedThirdPartyFetch } from "@/modules/stats";
