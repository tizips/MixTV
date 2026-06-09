import { readEdgeOneKvHash, writeEdgeOneKvHash } from "@/infrastructure/db/edgeone-kv-db-adapter";
import { defaultCloudSearchPanSouUrl } from "./admin-config-schemas";
import { AdminModuleValidationError } from "./admin-module-error";
import {
  asObject,
  createAdminModulesStore,
  now,
  readBoolean,
  readNumber,
  readString,
  type AdminModulesStore,
} from "./admin-modules-store";

export type { AdminModulesStore } from "./admin-modules-store";

export type CloudDriveType = "baidu" | "ali" | "quark";

export type CloudSearchDriveTypeKey =
  | "baidu"
  | "aliyun"
  | "quark"
  | "tianyi"
  | "uc"
  | "mobile"
  | "115"
  | "123"
  | "xunlei"
  | "pikpak"
  | "guangya"
  | "magnet"
  | "ed2k"
  | "other";

export interface CloudSearchDriveTypeOption {
  key: CloudSearchDriveTypeKey;
  label: string;
}

export interface CloudSearchConfig {
  enabled: boolean;
  panSouUrl: string;
  requestTimeoutSeconds: number;
  supportedDriveTypes: CloudSearchDriveTypeKey[];
  updatedAt: string | null;
}

const key = "cloud-search";
const storeNamespace = "admin";

const cloudSearchDriveTypeKeys = new Set<CloudSearchDriveTypeKey>([
  "baidu",
  "aliyun",
  "quark",
  "tianyi",
  "uc",
  "mobile",
  "115",
  "123",
  "xunlei",
  "pikpak",
  "guangya",
  "magnet",
  "ed2k",
  "other",
]);

export const defaultCloudSearchConfig: CloudSearchConfig = {
  enabled: true,
  panSouUrl: defaultCloudSearchPanSouUrl,
  requestTimeoutSeconds: 30,
  supportedDriveTypes: [],
  updatedAt: null,
};

function isOneOf<T extends string>(value: unknown, values: Set<T>): value is T {
  return typeof value === "string" && values.has(value as T);
}

function normalizeCloudSearchDriveTypes(types: unknown): CloudSearchDriveTypeKey[] {
  if (!Array.isArray(types)) {
    return [];
  }

  return types.flatMap((type) => {
    if (type === "ali") {
      return ["aliyun"];
    }

    if (type === "others") {
      return ["other"];
    }

    return isOneOf(type, cloudSearchDriveTypeKeys) ? [type] : [];
  });
}

function normalizePanSouUrl(value: string) {
  const trimmed = value.trim();
  return trimmed || defaultCloudSearchPanSouUrl;
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

function readHashCloudSearchConfig(raw: unknown): Partial<CloudSearchConfig> | null {
  const record = toHashRecord(raw);

  if (Object.keys(record).length === 0) {
    return null;
  }

  let supportedDriveTypes: CloudSearchDriveTypeKey[] | undefined;

  if (typeof record.supportedDriveTypes === "string") {
    try {
      supportedDriveTypes = normalizeCloudSearchDriveTypes(JSON.parse(record.supportedDriveTypes) as unknown);
    } catch {
      supportedDriveTypes = [];
    }
  }

  return {
    ...(record.enabled === "true" ? { enabled: true } : record.enabled === "false" ? { enabled: false } : {}),
    ...(typeof record.panSouUrl === "string" ? { panSouUrl: record.panSouUrl } : {}),
    ...(typeof record.requestTimeoutSeconds === "string"
      ? { requestTimeoutSeconds: readNumber({ requestTimeoutSeconds: record.requestTimeoutSeconds }, "requestTimeoutSeconds", 30, 1, 120) }
      : {}),
    ...(supportedDriveTypes ? { supportedDriveTypes } : {}),
    ...(typeof record.updatedAt === "string" ? { updatedAt: record.updatedAt } : {}),
  };
}

export async function getCloudSearchConfig(store: AdminModulesStore = createAdminModulesStore()) {
  const rawHashConfig = await readEdgeOneKvHash(store, key, { namespace: storeNamespace });
  const config = {
    ...defaultCloudSearchConfig,
    ...readHashCloudSearchConfig(rawHashConfig),
  };

  return {
    ...config,
    panSouUrl: normalizePanSouUrl(config.panSouUrl),
    supportedDriveTypes: normalizeCloudSearchDriveTypes(config.supportedDriveTypes),
  };
}

export async function saveCloudSearchConfig(input: unknown, store: AdminModulesStore = createAdminModulesStore()) {
  const payload = asObject(input);
  const supportedDriveTypes = Array.isArray(payload.supportedDriveTypes)
    ? normalizeCloudSearchDriveTypes(payload.supportedDriveTypes)
    : null;

  if (!supportedDriveTypes) {
    throw new AdminModuleValidationError("supportedDriveTypes is required.");
  }

  const saved: CloudSearchConfig = {
    enabled: readBoolean(payload, "enabled"),
    panSouUrl: normalizePanSouUrl(readString(payload, "panSouUrl")),
    requestTimeoutSeconds: readNumber(payload, "requestTimeoutSeconds", 30, 1, 120),
    supportedDriveTypes,
    updatedAt: now(),
  };

  await writeEdgeOneKvHash(store, key, {
    enabled: String(saved.enabled),
    panSouUrl: saved.panSouUrl,
    requestTimeoutSeconds: String(saved.requestTimeoutSeconds),
    supportedDriveTypes: JSON.stringify(saved.supportedDriveTypes),
    updatedAt: saved.updatedAt ?? "",
  }, { namespace: storeNamespace });

  return saved;
}

export async function testCloudSearchConnection(input: unknown) {
  const payload = asObject(input);
  const panSouUrl = normalizePanSouUrl(readString(payload, "panSouUrl"));
  return { ok: Boolean(panSouUrl), message: `PanSou endpoint accepted: ${panSouUrl}`, checkedAt: now() };
}
