import { createDbAdapter } from "@/infrastructure/db/db-adapter";
import type { DbPort } from "@/shared/db/db-port";

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

export type SiteConfigStore = DbPort<SiteConfig, string>;

export class SiteConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SiteConfigValidationError";
  }
}

const siteConfigNamespace = "admin:site-config";
const siteConfigKey = "config";
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
  siteName: "MixTV",
  siteAnnouncement: "欢迎来到 MixTV，请注意站点公告。",
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
  return createDbAdapter<SiteConfig>({
    namespace: siteConfigNamespace,
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

export async function getSiteConfig(
  store: SiteConfigStore = createSiteConfigStore(),
): Promise<SiteConfig> {
  return normalizeConfig(await store.get(siteConfigKey));
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

  await store.set(siteConfigKey, saved);

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

  await store.set(siteConfigKey, saved);

  return saved;
}
