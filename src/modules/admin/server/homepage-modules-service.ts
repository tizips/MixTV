import { createDbAdapter } from "@/infrastructure/db/db-adapter";
import type { DbPort } from "@/shared/db/db-port";
import { AdminModuleValidationError } from "./admin-modules-service";

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

const storeNamespace = "admin:homepage";
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

async function getStored<T>(key: string, defaults: T, store: HomepageModulesStore): Promise<T> {
  const stored = (await store.get(key)) as Partial<T> | null;
  return { ...defaults, ...stored };
}

async function saveStored<T>(key: string, value: T, store: HomepageModulesStore): Promise<T> {
  await store.set(key, value);
  return value;
}

export function isHomepageModuleKey(value: unknown): value is HomepageModuleKey {
  return typeof value === "string" && homepageKeys.includes(value as HomepageModuleKey);
}

export async function getHomepageConfig(
  store: HomepageModulesStore = createHomepageModulesStore(),
): Promise<HomepageConfig> {
  const stored = await getStored<HomepageConfig>(modulesStoreKey, defaultHomepageConfig, store);
  return {
    modules: { ...defaultHomepageConfig.modules, ...stored.modules },
    updatedAt: stored.updatedAt ?? null,
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

  return saveStored(modulesStoreKey, { modules, updatedAt: now() }, store);
}

export async function saveHomepageConfigSwitch(
  key: HomepageModuleKey,
  value: boolean,
  store: HomepageModulesStore = createHomepageModulesStore(),
): Promise<HomepageConfig> {
  const current = await getHomepageConfig(store);
  return saveStored(
    modulesStoreKey,
    {
      modules: {
        ...current.modules,
        [key]: value,
      },
      updatedAt: now(),
    },
    store,
  );
}
