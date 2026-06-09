import { readEdgeOneKvHash, writeEdgeOneKvHash } from "@/infrastructure/db/edgeone-kv-db-adapter";
import {
  asObject,
  createAdminModulesStore,
  now,
  readBoolean,
  readNumber,
  type AdminModulesStore,
} from "./admin-modules-store";

export type { AdminModulesStore } from "./admin-modules-store";

export interface TimingManagementConfig {
  autoRefreshEnabled: boolean;
  maxRecordsPerRun: number;
  recentActiveDays: number;
  onlyRefreshOngoingSeries: boolean;
  maxSearchPages: number;
  siteCacheSeconds: number;
  updatedAt: string | null;
}

const key = "timing-management";
const storeNamespace = "admin";

export const defaultTimingManagementConfig: TimingManagementConfig = {
  autoRefreshEnabled: true,
  maxRecordsPerRun: 100,
  recentActiveDays: 30,
  onlyRefreshOngoingSeries: true,
  maxSearchPages: 3,
  siteCacheSeconds: 3600,
  updatedAt: null,
};

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
    const hashKey = value[index];
    const fieldValue = value[index + 1];

    if (typeof hashKey === "string" && typeof fieldValue === "string") {
      record[hashKey] = fieldValue;
    }
  }

  return record;
}

function readHashTimingManagementConfig(raw: unknown): Partial<TimingManagementConfig> | null {
  const record = toHashRecord(raw);

  if (Object.keys(record).length === 0) {
    return null;
  }

  return {
    ...(record.autoRefreshEnabled === "true"
      ? { autoRefreshEnabled: true }
      : record.autoRefreshEnabled === "false"
        ? { autoRefreshEnabled: false }
        : {}),
    ...(typeof record.maxRecordsPerRun === "string"
      ? { maxRecordsPerRun: readNumber({ maxRecordsPerRun: record.maxRecordsPerRun }, "maxRecordsPerRun", 100, 1, 1000) }
      : {}),
    ...(typeof record.recentActiveDays === "string"
      ? { recentActiveDays: readNumber({ recentActiveDays: record.recentActiveDays }, "recentActiveDays", 30, 1, 365) }
      : {}),
    ...(record.onlyRefreshOngoingSeries === "true"
      ? { onlyRefreshOngoingSeries: true }
      : record.onlyRefreshOngoingSeries === "false"
        ? { onlyRefreshOngoingSeries: false }
        : {}),
    ...(typeof record.maxSearchPages === "string"
      ? { maxSearchPages: readNumber({ maxSearchPages: record.maxSearchPages }, "maxSearchPages", 3, 1, 20) }
      : {}),
    ...(typeof record.siteCacheSeconds === "string"
      ? { siteCacheSeconds: readNumber({ siteCacheSeconds: record.siteCacheSeconds }, "siteCacheSeconds", 3600, 0, 86400) }
      : {}),
    ...(typeof record.updatedAt === "string" ? { updatedAt: record.updatedAt } : {}),
  };
}

export async function getTimingManagementConfig(store: AdminModulesStore = createAdminModulesStore()) {
  const rawHashConfig = await readEdgeOneKvHash(store, key, { namespace: storeNamespace });

  return {
    ...defaultTimingManagementConfig,
    ...readHashTimingManagementConfig(rawHashConfig),
  };
}

export async function saveTimingManagementConfig(input: unknown, store: AdminModulesStore = createAdminModulesStore()) {
  const payload = asObject(input);
  const saved: TimingManagementConfig = {
    autoRefreshEnabled: readBoolean(payload, "autoRefreshEnabled"),
    maxRecordsPerRun: readNumber(payload, "maxRecordsPerRun", 100, 1, 1000),
    recentActiveDays: readNumber(payload, "recentActiveDays", 30, 1, 365),
    onlyRefreshOngoingSeries: readBoolean(payload, "onlyRefreshOngoingSeries"),
    maxSearchPages: readNumber(payload, "maxSearchPages", 3, 1, 20),
    siteCacheSeconds: readNumber(payload, "siteCacheSeconds", 3600, 0, 86400),
    updatedAt: now(),
  };

  await writeEdgeOneKvHash(store, key, {
    autoRefreshEnabled: String(saved.autoRefreshEnabled),
    maxRecordsPerRun: String(saved.maxRecordsPerRun),
    maxSearchPages: String(saved.maxSearchPages),
    onlyRefreshOngoingSeries: String(saved.onlyRefreshOngoingSeries),
    recentActiveDays: String(saved.recentActiveDays),
    siteCacheSeconds: String(saved.siteCacheSeconds),
    updatedAt: saved.updatedAt ?? "",
  }, { namespace: storeNamespace });

  return saved;
}
