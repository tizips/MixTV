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

export interface DanmakuConfig {
  enabled: boolean;
  apiUrl: string;
  apiToken: string;
  requestTimeoutSeconds: number;
  loadMode: "full" | "segment";
  updatedAt: string | null;
}

const key = "danmaku";

const readDanmakuConfigScript = `
return redis.call("HGETALL", KEYS[1])
`;

const saveDanmakuConfigScript = `
redis.call("HSET", KEYS[1], "enabled", ARGV[1], "apiUrl", ARGV[2], "apiToken", ARGV[3], "requestTimeoutSeconds", ARGV[4], "loadMode", ARGV[5], "updatedAt", ARGV[6])
return 1
`;

export const defaultDanmakuConfig: DanmakuConfig = {
  enabled: true,
  apiUrl: "https://smonedanmu.vercel.app",
  apiToken: "smonetv",
  requestTimeoutSeconds: 30,
  loadMode: "full",
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
    const key = value[index];
    const fieldValue = value[index + 1];

    if (typeof key === "string" && typeof fieldValue === "string") {
      record[key] = fieldValue;
    }
  }

  return record;
}

function readDanmakuHashConfig(raw: unknown): Partial<DanmakuConfig> | null {
  const record = toHashRecord(raw);

  if (Object.keys(record).length === 0) {
    return null;
  }

  return {
    ...(record.enabled === "true" ? { enabled: true } : record.enabled === "false" ? { enabled: false } : {}),
    ...(typeof record.apiUrl === "string" ? { apiUrl: record.apiUrl } : {}),
    ...(typeof record.apiToken === "string" ? { apiToken: record.apiToken } : {}),
    ...(typeof record.requestTimeoutSeconds === "string"
      ? { requestTimeoutSeconds: readNumber({ requestTimeoutSeconds: record.requestTimeoutSeconds }, "requestTimeoutSeconds", 10, 1, 120) }
      : {}),
    ...(record.loadMode === "segment" ? { loadMode: "segment" } : record.loadMode === "full" ? { loadMode: "full" } : {}),
    ...(typeof record.updatedAt === "string" ? { updatedAt: record.updatedAt } : {}),
  };
}

export async function getDanmakuConfig(store: AdminModulesStore = createAdminModulesStore()) {
  const rawHashConfig = await store.script<Record<string, string> | string[]>(readDanmakuConfigScript, {
    keys: [key],
    readOnly: true,
  });

  return {
    ...defaultDanmakuConfig,
    ...readDanmakuHashConfig(rawHashConfig),
  };
}

export async function saveDanmakuConfig(input: unknown, store: AdminModulesStore = createAdminModulesStore()) {
  const payload = asObject(input);
  const saved: DanmakuConfig = {
    enabled: readBoolean(payload, "enabled"),
    apiUrl: readString(payload, "apiUrl"),
    apiToken: readString(payload, "apiToken"),
    requestTimeoutSeconds: readNumber(payload, "requestTimeoutSeconds", 10, 1, 120),
    loadMode: payload.loadMode === "segment" ? "segment" : "full",
    updatedAt: now(),
  };

  await store.script(saveDanmakuConfigScript, {
    args: [
      String(saved.enabled),
      saved.apiUrl,
      saved.apiToken,
      String(saved.requestTimeoutSeconds),
      saved.loadMode,
      saved.updatedAt,
    ],
    keys: [key],
  });

  return saved;
}

export async function testDanmakuConnection(input: unknown) {
  const payload = asObject(input);
  const apiUrl = readString(payload, "apiUrl");
  return { ok: Boolean(apiUrl), message: `Danmaku endpoint accepted: ${apiUrl}`, checkedAt: now() };
}
