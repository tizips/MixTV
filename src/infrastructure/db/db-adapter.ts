import { createRedisDbAdapter, type RedisDbOptions } from "@/infrastructure/db/redis-db-adapter";
import type { DbPort } from "@/shared/db/db-port";

export interface StorageEnv {
  [key: string]: string | undefined;
  REDIS_URL?: string;
  STORAGE_TYPE?: string;
}

export type StorageType = "redis";

export interface DbAdapterOptions extends Omit<RedisDbOptions, "url"> {
  env?: StorageEnv;
  url?: string;
}

export const resolveStorageType = (env: StorageEnv = process.env): StorageType => {
  const storageType = (env.STORAGE_TYPE ?? "redis").trim().toLowerCase();

  if (storageType === "redis") {
    return storageType;
  }

  throw new Error(`Unsupported STORAGE_TYPE "${env.STORAGE_TYPE}". Supported values: redis`);
};

export const createDbAdapter = <TValue>(
  options: DbAdapterOptions,
): DbPort<TValue, string> => {
  const env = options.env ?? process.env;
  const storageType = resolveStorageType(env);

  switch (storageType) {
    case "redis":
      return createRedisDbAdapter<TValue>({
        client: options.client,
        namespace: options.namespace,
        url: options.url ?? env.REDIS_URL,
      });
  }
};
