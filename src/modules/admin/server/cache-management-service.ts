import { createDbAdapter } from "@/infrastructure/db/db-adapter";
import {
  asObject,
  createAdminModulesStore,
  getStored,
  now,
  saveStored,
  type AdminModulesStore,
} from "./admin-modules-store";

export type { AdminModulesStore } from "./admin-modules-store";

export interface CacheCategory {
  key: string;
  icon: string;
  title: string;
  description: string;
  items: number;
  sizeKb: number;
}

export interface CacheData {
  categories: CacheCategory[];
  updatedAt: string | null;
}

export interface CacheKvCleanupResult {
  completedAt: string;
  deleted: number;
  scanned: number;
}

export interface CacheKvCleanupOptions {
  batchSize?: number;
  now?: () => number;
  pattern?: string;
  store?: AdminModulesStore;
}

const key = "cache";
const cacheKvCleanupBatchSize = 1000;
const cacheKvCleanupPattern = "*";

const cleanupExpiredCacheKvScript = `
local cursor = "0"
local scanned = 0
local deleted = 0

repeat
  local result = redis.call("SCAN", cursor, "MATCH", ARGV[1], "COUNT", ARGV[2])
  cursor = result[1]
  local batch = result[2]

  for index = 1, #batch do
    scanned = scanned + 1
    local raw = redis.call("GET", batch[index])
    if raw then
      local ok, payload = pcall(cjson.decode, raw)
      if ok and type(payload) == "table" and type(payload.expiresAt) == "number" and payload.expiresAt <= tonumber(ARGV[3]) then
        redis.call("DEL", batch[index])
        deleted = deleted + 1
      end
    end
  end
until cursor == "0"

return { scanned = scanned, deleted = deleted }
`;

const defaultCacheData: CacheData = {
  categories: [
    {
      key: "douban",
      icon: "star-half",
      title: "豆瓣数据",
      description: "缓存豆瓣评分、简介、海报和演员信息。",
      items: 128,
      sizeKb: 18432,
    },
    {
      key: "danmaku",
      icon: "chat-square-text",
      title: "弹幕数据",
      description: "缓存弹幕源查询结果和视频弹幕索引。",
      items: 86,
      sizeKb: 9216,
    },
    {
      key: "tmdb",
      icon: "film",
      title: "TMDB数据",
      description: "缓存 TMDB 剧集、电影、季集和图片元数据。",
      items: 214,
      sizeKb: 32768,
    },
    {
      key: "short-drama",
      icon: "collection-play",
      title: "短剧数据",
      description: "缓存短剧列表、播放地址和详情聚合结果。",
      items: 62,
      sizeKb: 6144,
    },
  ],
  updatedAt: null,
};

export async function getCacheData(store: AdminModulesStore = createAdminModulesStore()) {
  return getStored<CacheData>(key, defaultCacheData, store);
}

export async function refreshCacheStats(store: AdminModulesStore = createAdminModulesStore()) {
  const current = await getCacheData(store);
  return saveStored(key, { ...current, updatedAt: now() }, store);
}

export async function clearCache(input: unknown, store: AdminModulesStore = createAdminModulesStore()) {
  const payload = asObject(input);
  const categoryKey = typeof payload.key === "string" ? payload.key : null;
  const current = await getCacheData(store);
  const categories = current.categories.map((category) =>
    categoryKey === null || category.key === categoryKey ? { ...category, items: 0, sizeKb: 0 } : category,
  );

  return saveStored(key, { categories, updatedAt: now() }, store);
}

function createCacheKvCleanupStore(): AdminModulesStore {
  return createDbAdapter<unknown>({ namespace: "" });
}

function readCleanupCount(value: unknown) {
  const count = Number(value);

  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

export async function cleanupExpiredCacheKvEntries({
  batchSize = cacheKvCleanupBatchSize,
  now: readNow = Date.now,
  pattern = cacheKvCleanupPattern,
  store = createCacheKvCleanupStore(),
}: CacheKvCleanupOptions = {}): Promise<CacheKvCleanupResult> {
  const completedAtMs = readNow();
  const result = await store.script<{ deleted?: unknown; scanned?: unknown }>(cleanupExpiredCacheKvScript, {
    args: [pattern, batchSize, completedAtMs],
    readOnly: false,
  });

  return {
    completedAt: new Date(completedAtMs).toISOString(),
    deleted: readCleanupCount(result?.deleted),
    scanned: readCleanupCount(result?.scanned),
  };
}
