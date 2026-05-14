import { createRedisDbAdapter, type RedisDbOptions } from "@/infrastructure/db/redis-db-adapter";
import { createUpstashDbAdapter, type UpstashDbOptions } from "@/infrastructure/db/upstash-db-adapter";
import type { DbPort } from "@/shared/db/db-port";

export interface StorageEnv {
  [key: string]: string | undefined;
  REDIS_URL?: string;
  STORAGE_TYPE?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  UPSTASH_REDIS_REST_URL?: string;
}

export type StorageType = "redis" | "upstash";

export interface DbAdapterOptions extends Omit<UpstashDbOptions, "client" | "url"> {
  client?: RedisDbOptions["client"] | UpstashDbOptions["client"];
  env?: StorageEnv;
  url?: string;
}

export const resolveStorageType = (env: StorageEnv = process.env): StorageType => {
  const storageType = (env.STORAGE_TYPE ?? "").trim().toLowerCase();

  if (storageType === "redis") {
    return storageType;
  }

  if (storageType === "upstash") {
    return storageType;
  }

  throw new Error(`Unsupported STORAGE_TYPE "${env.STORAGE_TYPE}". Supported values: redis, upstash`);
};

export const createDbAdapter = <TValue>(
  options: DbAdapterOptions,
): DbPort<TValue, string> => {
  const env = options.env ?? process.env;
  const storageType = resolveStorageType(env);

  switch (storageType) {
    case "redis":
      return createRedisDbAdapter<TValue>({
        client: options.client as RedisDbOptions["client"],
        env,
        namespace: options.namespace,
        url: options.url ?? env.REDIS_URL,
      });
    case "upstash":
      return createUpstashDbAdapter<TValue>({
        client: options.client as UpstashDbOptions["client"],
        env,
        namespace: options.namespace,
        token: options.token,
        url: options.url ?? env.UPSTASH_REDIS_REST_URL,
      });
  }
};
