import {
  cleanupExpiredEdgeOneKvEntries,
  getEdgeOneKvBinding,
} from "@/infrastructure/db/edgeone-kv-db-adapter";
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
const cacheKvBindingName = "cache";
const cacheKvCleanupBatchSize = 1000;
const cacheKvCleanupPattern = "*";

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
  return getEdgeOneKvBinding({
    bindingName: cacheKvBindingName,
  });
}

export async function cleanupExpiredCacheKvEntries({
  batchSize = cacheKvCleanupBatchSize,
  now: readNow = Date.now,
  pattern = cacheKvCleanupPattern,
  store = createCacheKvCleanupStore(),
}: CacheKvCleanupOptions = {}): Promise<CacheKvCleanupResult> {
  const completedAtMs = readNow();
  const result = await cleanupExpiredEdgeOneKvEntries(store, {
    expiresBefore: completedAtMs,
    limit: batchSize,
    pattern,
  });

  return {
    completedAt: new Date(completedAtMs).toISOString(),
    deleted: result.deleted,
    scanned: result.scanned,
  };
}
