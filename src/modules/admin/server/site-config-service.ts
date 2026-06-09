import {
  getEdgeOneKvBinding,
  readEdgeOneKvHash,
  type EdgeOneKvBinding,
  writeEdgeOneKvHash,
} from "@/infrastructure/db/edgeone-kv-db-adapter";
import { env } from "@/shared/env";

export type SiteConfigProxyMode =
  | "direct"
  | "zwei"
  | "official-ali"
  | "cml-tencent"
  | "cml-ali"
  | "custom";

export interface SiteConfig {
  siteName: string;
  siteAnnouncement: string;
  doubanDataProxyMode: SiteConfigProxyMode;
  doubanDataProxyUrl: string;
  doubanImageProxyMode: SiteConfigProxyMode;
  doubanImageProxyUrl: string;
  doubanAuth: string;
  enableKeywordFilter: boolean;
  showAdultContent: boolean;
  enableStreamingSearch: boolean;
  updatedAt: string | null;
}

export type SiteConfigLeftInput = Pick<
  SiteConfig,
  | "siteName"
  | "siteAnnouncement"
  | "doubanDataProxyMode"
  | "doubanDataProxyUrl"
  | "doubanImageProxyMode"
  | "doubanImageProxyUrl"
  | "doubanAuth"
>;

export type SiteConfigSwitchKey = Extract<
  keyof SiteConfig,
  "enableKeywordFilter" | "showAdultContent" | "enableStreamingSearch"
>;

export type SiteConfigStore = EdgeOneKvBinding;

export class SiteConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SiteConfigValidationError";
  }
}

const siteConfigNamespace = "admin";
const siteConfigKvBindingName = "cfg";
const siteConfigKey = "site";
const proxyModes = new Set<SiteConfigProxyMode>([
  "direct",
  "zwei",
  "official-ali",
  "cml-tencent",
  "cml-ali",
  "custom",
]);
const switchKeys = new Set<SiteConfigSwitchKey>([
  "enableKeywordFilter",
  "showAdultContent",
  "enableStreamingSearch",
]);

export const defaultSiteConfig: SiteConfig = {
  siteName: env.NEXT_PUBLIC_SITE_NAME,
  siteAnnouncement: `欢迎来到 ${env.NEXT_PUBLIC_SITE_NAME}，请注意站点公告。`,
  doubanDataProxyMode: "direct",
  doubanDataProxyUrl: "",
  doubanImageProxyMode: "direct",
  doubanImageProxyUrl: "",
  doubanAuth: "",
  enableKeywordFilter: true,
  showAdultContent: false,
  enableStreamingSearch: true,
  updatedAt: null,
};

export function createSiteConfigStore(): SiteConfigStore {
  return getEdgeOneKvBinding({
    bindingName: siteConfigKvBindingName,
  });
}

function isProxyMode(value: unknown): value is SiteConfigProxyMode {
  return typeof value === "string" && proxyModes.has(value as SiteConfigProxyMode);
}

export function isSiteConfigSwitchKey(value: unknown): value is SiteConfigSwitchKey {
  return typeof value === "string" && switchKeys.has(value as SiteConfigSwitchKey);
}

function readString(payload: Record<string, unknown>, key: keyof SiteConfigLeftInput): string {
  const value = payload[key];

  if (typeof value !== "string") {
    throw new SiteConfigValidationError(`${key} is required.`);
  }

  return value.trim();
}

function readOptionalString(
  payload: Record<string, unknown>,
  key: "siteName" | "siteAnnouncement",
  fallback: string,
): string {
  return Object.hasOwn(payload, key) ? readString(payload, key) : fallback;
}

function readProxyMode(payload: Record<string, unknown>, key: "doubanDataProxyMode" | "doubanImageProxyMode") {
  const value = payload[key];

  if (!isProxyMode(value)) {
    throw new SiteConfigValidationError(`${key} is invalid.`);
  }

  return value;
}

function normalizeConfig(config: Partial<SiteConfig> | null): SiteConfig {
  return {
    ...defaultSiteConfig,
    ...config,
    updatedAt: config?.updatedAt ?? null,
  };
}

function toHashRecord(value: unknown): Record<string, string> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  }

  if (!Array.isArray(value)) {
    return {};
  }

  const record: Record<string, string> = {};

  for (let index = 0; index < value.length; index += 2) {
    const key = value[index];
    const fieldValue = value[index + 1];

    if (typeof key === "string" && typeof fieldValue === "string") {
      record[key] = fieldValue;
    }
  }

  return record;
}

function readHashSiteConfig(raw: unknown): Partial<SiteConfig> | null {
  const record = toHashRecord(raw);

  if (Object.keys(record).length === 0) {
    return null;
  }

  return {
    ...(typeof record.siteName === "string" ? { siteName: record.siteName } : {}),
    ...(typeof record.siteAnnouncement === "string" ? { siteAnnouncement: record.siteAnnouncement } : {}),
    ...(isProxyMode(record.doubanDataProxyMode) ? { doubanDataProxyMode: record.doubanDataProxyMode } : {}),
    ...(typeof record.doubanDataProxyUrl === "string" ? { doubanDataProxyUrl: record.doubanDataProxyUrl } : {}),
    ...(isProxyMode(record.doubanImageProxyMode) ? { doubanImageProxyMode: record.doubanImageProxyMode } : {}),
    ...(typeof record.doubanImageProxyUrl === "string" ? { doubanImageProxyUrl: record.doubanImageProxyUrl } : {}),
    ...(typeof record.doubanAuth === "string" ? { doubanAuth: record.doubanAuth } : {}),
    ...(record.enableKeywordFilter === "true"
      ? { enableKeywordFilter: true }
      : record.enableKeywordFilter === "false"
        ? { enableKeywordFilter: false }
        : {}),
    ...(record.showAdultContent === "true"
      ? { showAdultContent: true }
      : record.showAdultContent === "false"
        ? { showAdultContent: false }
        : {}),
    ...(record.enableStreamingSearch === "true"
      ? { enableStreamingSearch: true }
      : record.enableStreamingSearch === "false"
        ? { enableStreamingSearch: false }
        : {}),
    ...(typeof record.updatedAt === "string" ? { updatedAt: record.updatedAt } : {}),
  };
}

export async function getSiteConfig(
  store: SiteConfigStore = createSiteConfigStore(),
): Promise<SiteConfig> {
  const hashConfig = readHashSiteConfig(await readEdgeOneKvHash(store, siteConfigKey, { namespace: siteConfigNamespace }));

  return normalizeConfig(hashConfig);
}

async function persistSiteConfig(store: SiteConfigStore, config: SiteConfig) {
  await writeEdgeOneKvHash(store, siteConfigKey, {
    doubanAuth: config.doubanAuth,
    doubanDataProxyMode: config.doubanDataProxyMode,
    doubanDataProxyUrl: config.doubanDataProxyUrl,
    doubanImageProxyMode: config.doubanImageProxyMode,
    doubanImageProxyUrl: config.doubanImageProxyUrl,
    enableKeywordFilter: String(config.enableKeywordFilter),
    enableStreamingSearch: String(config.enableStreamingSearch),
    showAdultContent: String(config.showAdultContent),
    siteAnnouncement: config.siteAnnouncement,
    siteName: config.siteName,
    updatedAt: config.updatedAt ?? "",
  }, { namespace: siteConfigNamespace });
}

export async function saveSiteConfigLeft(
  input: unknown,
  store: SiteConfigStore = createSiteConfigStore(),
): Promise<SiteConfig> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new SiteConfigValidationError("Request body must be an object.");
  }

  const payload = input as Record<string, unknown>;
  const current = await getSiteConfig(store);
  const saved: SiteConfig = {
    ...current,
    siteName: readOptionalString(payload, "siteName", current.siteName),
    siteAnnouncement: readOptionalString(payload, "siteAnnouncement", current.siteAnnouncement),
    doubanDataProxyMode: readProxyMode(payload, "doubanDataProxyMode"),
    doubanDataProxyUrl: readString(payload, "doubanDataProxyUrl"),
    doubanImageProxyMode: readProxyMode(payload, "doubanImageProxyMode"),
    doubanImageProxyUrl: readString(payload, "doubanImageProxyUrl"),
    doubanAuth: readString(payload, "doubanAuth"),
    updatedAt: new Date().toISOString(),
  };

  await persistSiteConfig(store, saved);

  return saved;
}

export async function saveSiteConfigSwitch(
  key: SiteConfigSwitchKey,
  value: boolean,
  store: SiteConfigStore = createSiteConfigStore(),
): Promise<SiteConfig> {
  const current = await getSiteConfig(store);
  const saved: SiteConfig = {
    ...current,
    [key]: value,
    updatedAt: new Date().toISOString(),
  };

  await persistSiteConfig(store, saved);

  return saved;
}
