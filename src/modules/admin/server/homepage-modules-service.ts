import { createDbAdapter } from "@/infrastructure/db/db-adapter";
import type { DbPort } from "@/shared/db/db-port";
import { AdminModuleValidationError } from "./admin-module-error";

export type HomepageModuleKey =
  | "carousel"
  | "welcome-announcement"
  | "continue-watching"
  | "coming-soon"
  | "trending-movies"
  | "trending-series"
  | "new-anime"
  | "trending-variety"
  | "trending-short-dramas";

export interface HomepageConfig {
  modules: Record<HomepageModuleKey, boolean>;
  updatedAt: string | null;
}

export type HomepageModulesStore = DbPort<unknown, string>;

const storeNamespace = "admin";
const modulesStoreKey = "modules";
const readHomepageConfigScript = `
return redis.call("HGETALL", KEYS[1])
`;
const saveHomepageConfigScript = `
redis.call("HSET", KEYS[1], "welcome-announcement", ARGV[1], "carousel", ARGV[2], "continue-watching", ARGV[3], "coming-soon", ARGV[4], "trending-movies", ARGV[5], "trending-series", ARGV[6], "new-anime", ARGV[7], "trending-variety", ARGV[8], "trending-short-dramas", ARGV[9], "updatedAt", ARGV[10])
return 1
`;

const homepageKeys: HomepageModuleKey[] = [
  "welcome-announcement",
  "carousel",
  "continue-watching",
  "coming-soon",
  "trending-movies",
  "trending-series",
  "new-anime",
  "trending-variety",
  "trending-short-dramas",
];

export const defaultHomepageConfig: HomepageConfig = {
  modules: Object.fromEntries(homepageKeys.map((key) => [key, true])) as Record<HomepageModuleKey, boolean>,
  updatedAt: null,
};

export function createHomepageModulesStore(): HomepageModulesStore {
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

export function isHomepageModuleKey(value: unknown): value is HomepageModuleKey {
  return typeof value === "string" && homepageKeys.includes(value as HomepageModuleKey);
}

function toHashRecord(value: unknown): Record<string, string> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
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

function readHashHomepageConfig(raw: unknown): HomepageConfig | null {
  const record = toHashRecord(raw);

  if (Object.keys(record).length === 0) {
    return null;
  }

  const modules = { ...defaultHomepageConfig.modules };

  for (const key of homepageKeys) {
    const value = record[key];

    if (value === "true") {
      modules[key] = true;
      continue;
    }

    if (value === "false") {
      modules[key] = false;
    }
  }

  return {
    modules,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : null,
  };
}

async function persistHomepageConfig(store: HomepageModulesStore, value: HomepageConfig) {
  await store.script(saveHomepageConfigScript, {
    args: [
      String(value.modules["welcome-announcement"]),
      String(value.modules.carousel),
      String(value.modules["continue-watching"]),
      String(value.modules["coming-soon"]),
      String(value.modules["trending-movies"]),
      String(value.modules["trending-series"]),
      String(value.modules["new-anime"]),
      String(value.modules["trending-variety"]),
      String(value.modules["trending-short-dramas"]),
      value.updatedAt,
    ],
    keys: [modulesStoreKey],
  });

  return value;
}

export async function getHomepageConfig(
  store: HomepageModulesStore = createHomepageModulesStore(),
): Promise<HomepageConfig> {
  const stored = readHashHomepageConfig(await store.script<Record<string, string> | string[]>(readHomepageConfigScript, {
    keys: [modulesStoreKey],
    readOnly: true,
  }));
  return {
    modules: stored?.modules ?? { ...defaultHomepageConfig.modules },
    updatedAt: stored?.updatedAt ?? null,
  };
}

export async function saveHomepageConfig(
  input: unknown,
  store: HomepageModulesStore = createHomepageModulesStore(),
): Promise<HomepageConfig> {
  const payload = asObject(input);
  const modulesPayload = asObject(payload.modules);
  const modules = { ...defaultHomepageConfig.modules };

  for (const key of homepageKeys) {
    const value = modulesPayload[key];
    if (typeof value !== "boolean") {
      throw new AdminModuleValidationError(`modules.${key} is required.`);
    }
    modules[key] = value;
  }

  return persistHomepageConfig(store, { modules, updatedAt: now() });
}

export async function saveHomepageConfigSwitch(
  key: HomepageModuleKey,
  value: boolean,
  store: HomepageModulesStore = createHomepageModulesStore(),
): Promise<HomepageConfig> {
  const current = await getHomepageConfig(store);
  return persistHomepageConfig(store, {
    modules: {
      ...current.modules,
      [key]: value,
    },
    updatedAt: now(),
  });
}
