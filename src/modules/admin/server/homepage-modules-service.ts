import {
  getEdgeOneKvBinding,
  readEdgeOneKvHash,
  type EdgeOneKvBinding,
  writeEdgeOneKvHash,
} from "@/infrastructure/db/edgeone-kv-db-adapter";
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

export type HomepageModulesStore = EdgeOneKvBinding;

const storeNamespace = "admin";
const storeKvBindingName = "cfg";
const modulesStoreKey = "modules";

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
  return getEdgeOneKvBinding({
    bindingName: storeKvBindingName,
  });
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
  await writeEdgeOneKvHash(store, modulesStoreKey, {
    carousel: String(value.modules.carousel),
    "coming-soon": String(value.modules["coming-soon"]),
    "continue-watching": String(value.modules["continue-watching"]),
    "new-anime": String(value.modules["new-anime"]),
    "trending-movies": String(value.modules["trending-movies"]),
    "trending-series": String(value.modules["trending-series"]),
    "trending-short-dramas": String(value.modules["trending-short-dramas"]),
    "trending-variety": String(value.modules["trending-variety"]),
    updatedAt: value.updatedAt ?? "",
    "welcome-announcement": String(value.modules["welcome-announcement"]),
  }, { namespace: storeNamespace });

  return value;
}

export async function getHomepageConfig(
  store: HomepageModulesStore = createHomepageModulesStore(),
): Promise<HomepageConfig> {
  const stored = readHashHomepageConfig(await readEdgeOneKvHash(store, modulesStoreKey, { namespace: storeNamespace }));
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
