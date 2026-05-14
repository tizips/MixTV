import { createDbAdapter } from "@/infrastructure/db/db-adapter";
import type { DbPort } from "@/shared/db/db-port";
import { AdminModuleValidationError } from "./admin-module-error";

export {
  createUser,
  deleteUser,
  getUsers,
  updateUser,
  UserConfigValidationError,
} from "./user-config-service";
export type { UserCollection, UserItem, UserRole, UserStatus } from "./user-config-service";

export { AdminModuleValidationError } from "./admin-module-error";

export type CloudDriveType = "baidu" | "ali" | "quark";

export interface CloudSearchConfig {
  enabled: boolean;
  panSouUrl: string;
  requestTimeoutSeconds: number;
  supportedDriveTypes: CloudDriveType[];
  updatedAt: string | null;
}

export interface DanmakuConfig {
  enabled: boolean;
  apiUrl: string;
  apiToken: string;
  requestTimeoutSeconds: number;
  updatedAt: string | null;
}

export interface TimingManagementConfig {
  autoRefreshEnabled: boolean;
  maxRecordsPerRun: number;
  recentActiveDays: number;
  onlyRefreshOngoingSeries: boolean;
  maxSearchPages: number;
  siteCacheSeconds: number;
  updatedAt: string | null;
}

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

export interface PerformanceMetric {
  key: string;
  icon: string;
  title: string;
  value: string;
  detail: string;
  detailAccent?: string;
  tone: string;
}

export type AdminModulesStore = DbPort<unknown, string>;

const storeNamespace = "admin:modules";
const keys = {
  cache: "cache",
  cloudSearch: "cloud-search",
  danmaku: "danmaku",
  timing: "timing-management",
};

const cloudDriveTypes = new Set<CloudDriveType>(["baidu", "ali", "quark"]);

export const defaultCloudSearchConfig: CloudSearchConfig = {
  enabled: true,
  panSouUrl: "http://localhost:8888",
  requestTimeoutSeconds: 10,
  supportedDriveTypes: ["baidu", "ali", "quark"],
  updatedAt: null,
};

export const defaultDanmakuConfig: DanmakuConfig = {
  enabled: true,
  apiUrl: "https://smonedanmu.vercel.app",
  apiToken: "smonetv",
  requestTimeoutSeconds: 10,
  updatedAt: null,
};

export const defaultTimingManagementConfig: TimingManagementConfig = {
  autoRefreshEnabled: true,
  maxRecordsPerRun: 100,
  recentActiveDays: 30,
  onlyRefreshOngoingSeries: true,
  maxSearchPages: 3,
  siteCacheSeconds: 3600,
  updatedAt: null,
};

const defaultCacheData: CacheData = {
  categories: [
    {
      key: "douban",
      icon: "bi-star-half",
      title: "豆瓣数据",
      description: "缓存豆瓣评分、简介、海报和演员信息。",
      items: 128,
      sizeKb: 18432,
    },
    {
      key: "danmaku",
      icon: "bi-chat-square-text",
      title: "弹幕数据",
      description: "缓存弹幕源查询结果和视频弹幕索引。",
      items: 86,
      sizeKb: 9216,
    },
    {
      key: "tmdb",
      icon: "bi-film",
      title: "TMDB数据",
      description: "缓存 TMDB 剧集、电影、季集和图片元数据。",
      items: 214,
      sizeKb: 32768,
    },
    {
      key: "short-drama",
      icon: "bi-collection-play",
      title: "短剧数据",
      description: "缓存短剧列表、播放地址和详情聚合结果。",
      items: 62,
      sizeKb: 6144,
    },
  ],
  updatedAt: null,
};

export function createAdminModulesStore(): AdminModulesStore {
  return createDbAdapter<unknown>({ namespace: storeNamespace });
}

function now() {
  return new Date().toISOString();
}

function asObject(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new AdminModuleValidationError("Request body must be an object.");
  }

  return payload as Record<string, unknown>;
}

function readString(payload: Record<string, unknown>, key: string): string;
function readString(payload: Record<string, unknown>, key: string, required: false): string | undefined;
function readString(payload: Record<string, unknown>, key: string, required = true) {
  const value = payload[key];

  if (typeof value !== "string") {
    if (!required) {
      return undefined;
    }

    throw new AdminModuleValidationError(`${key} is required.`);
  }

  return value.trim();
}

function readBoolean(payload: Record<string, unknown>, key: string): boolean;
function readBoolean(payload: Record<string, unknown>, key: string, required: false): boolean | undefined;
function readBoolean(payload: Record<string, unknown>, key: string, required = true) {
  const value = payload[key];

  if (typeof value !== "boolean") {
    if (!required) {
      return undefined;
    }

    throw new AdminModuleValidationError(`${key} is required.`);
  }

  return value;
}

function readNumber(payload: Record<string, unknown>, key: string, fallback: number, min: number, max: number) {
  const value = payload[key];
  const number = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(number)));
}

function isOneOf<T extends string>(value: unknown, values: Set<T>): value is T {
  return typeof value === "string" && values.has(value as T);
}

async function getStored<T>(key: string, defaults: T, store: AdminModulesStore): Promise<T> {
  const stored = (await store.get(key)) as Partial<T> | null;
  return { ...defaults, ...stored };
}

async function saveStored<T>(key: string, value: T, store: AdminModulesStore): Promise<T> {
  await store.set(key, value);
  return value;
}

export async function getCloudSearchConfig(store: AdminModulesStore = createAdminModulesStore()) {
  return getStored<CloudSearchConfig>(keys.cloudSearch, defaultCloudSearchConfig, store);
}

export async function saveCloudSearchConfig(input: unknown, store: AdminModulesStore = createAdminModulesStore()) {
  const payload = asObject(input);
  const supportedDriveTypes = Array.isArray(payload.supportedDriveTypes)
    ? payload.supportedDriveTypes.filter((type): type is CloudDriveType => isOneOf(type, cloudDriveTypes))
    : null;

  if (!supportedDriveTypes) {
    throw new AdminModuleValidationError("supportedDriveTypes is required.");
  }

  return saveStored<CloudSearchConfig>(
    keys.cloudSearch,
    {
      enabled: readBoolean(payload, "enabled"),
      panSouUrl: readString(payload, "panSouUrl"),
      requestTimeoutSeconds: readNumber(payload, "requestTimeoutSeconds", 10, 1, 120),
      supportedDriveTypes,
      updatedAt: now(),
    },
    store,
  );
}

export async function testCloudSearchConnection(input: unknown) {
  const payload = asObject(input);
  const panSouUrl = readString(payload, "panSouUrl");
  return { ok: Boolean(panSouUrl), message: `PanSou endpoint accepted: ${panSouUrl}`, checkedAt: now() };
}

export async function getDanmakuConfig(store: AdminModulesStore = createAdminModulesStore()) {
  return getStored<DanmakuConfig>(keys.danmaku, defaultDanmakuConfig, store);
}

export async function saveDanmakuConfig(input: unknown, store: AdminModulesStore = createAdminModulesStore()) {
  const payload = asObject(input);
  return saveStored<DanmakuConfig>(
    keys.danmaku,
    {
      enabled: readBoolean(payload, "enabled"),
      apiUrl: readString(payload, "apiUrl"),
      apiToken: readString(payload, "apiToken"),
      requestTimeoutSeconds: readNumber(payload, "requestTimeoutSeconds", 10, 1, 120),
      updatedAt: now(),
    },
    store,
  );
}

export async function testDanmakuConnection(input: unknown) {
  const payload = asObject(input);
  const apiUrl = readString(payload, "apiUrl");
  return { ok: Boolean(apiUrl), message: `Danmaku endpoint accepted: ${apiUrl}`, checkedAt: now() };
}

export async function getTimingManagementConfig(store: AdminModulesStore = createAdminModulesStore()) {
  return getStored<TimingManagementConfig>(keys.timing, defaultTimingManagementConfig, store);
}

export async function saveTimingManagementConfig(input: unknown, store: AdminModulesStore = createAdminModulesStore()) {
  const payload = asObject(input);
  return saveStored<TimingManagementConfig>(
    keys.timing,
    {
      autoRefreshEnabled: readBoolean(payload, "autoRefreshEnabled"),
      maxRecordsPerRun: readNumber(payload, "maxRecordsPerRun", 100, 1, 1000),
      recentActiveDays: readNumber(payload, "recentActiveDays", 30, 1, 365),
      onlyRefreshOngoingSeries: readBoolean(payload, "onlyRefreshOngoingSeries"),
      maxSearchPages: readNumber(payload, "maxSearchPages", 3, 1, 20),
      siteCacheSeconds: readNumber(payload, "siteCacheSeconds", 3600, 0, 86400),
      updatedAt: now(),
    },
    store,
  );
}

export async function getCacheData(store: AdminModulesStore = createAdminModulesStore()) {
  return getStored<CacheData>(keys.cache, defaultCacheData, store);
}

export async function refreshCacheStats(store: AdminModulesStore = createAdminModulesStore()) {
  const current = await getCacheData(store);
  return saveStored(keys.cache, { ...current, updatedAt: now() }, store);
}

export async function clearCache(input: unknown, store: AdminModulesStore = createAdminModulesStore()) {
  const payload = asObject(input);
  const categoryKey = typeof payload.key === "string" ? payload.key : null;
  const current = await getCacheData(store);
  const categories = current.categories.map((category) =>
    categoryKey === null || category.key === categoryKey ? { ...category, items: 0, sizeKb: 0 } : category,
  );

  return saveStored(keys.cache, { categories, updatedAt: now() }, store);
}

export async function exportMigrationBackup(input: unknown) {
  const payload = asObject(input);
  const password = readString(payload, "password");
  if (!password) {
    throw new AdminModuleValidationError("password is required.");
  }
  return {
    app: "MixTV",
    version: 1,
    exportedAt: now(),
    includes: ["管理配置", "用户数据", "播放记录", "收藏夹", "想看"],
  };
}

export async function importMigrationBackup(input: unknown) {
  const payload = asObject(input);
  const password = readString(payload, "password");
  if (!password) {
    throw new AdminModuleValidationError("password is required.");
  }
  return { importedAt: now(), message: "Backup import accepted." };
}

export async function getPerformanceMetrics() {
  const checkedAt = now();
  const metrics: PerformanceMetric[] = [
    { key: "process-cpu", icon: "bi-cpu", title: "进程 CPU", value: "18%", detail: "Edge runtime estimate", tone: "text-accent" },
    { key: "process-memory", icon: "bi-memory", title: "进程内存", value: "412 MB", detail: "Heap memory estimate", detailAccent: "/ 512 MB", tone: "text-accent" },
    { key: "system-memory", icon: "bi-pc-display-horizontal", title: "系统内存", value: "867.42 MB", detail: "Runtime memory estimate", detailAccent: "(43.5%)", tone: "text-accent" },
    { key: "db-query", icon: "bi-database", title: "DB 查询/分钟", value: "1,248", detail: "平均: 5.2 次/请求", detailAccent: "(良好)", tone: "text-success" },
    { key: "request", icon: "bi-arrow-left-right", title: "请求/分钟", value: "3,906", detail: "平均响应: 417ms", detailAccent: "(可接受)", tone: "text-warning" },
    { key: "api-traffic", icon: "bi-activity", title: "API 流量/分钟", value: "86 MB", detail: "最近 1 分钟出入站流量", detailAccent: "(非常轻量)", tone: "text-accent" },
  ];

  return { checkedAt, metrics };
}
