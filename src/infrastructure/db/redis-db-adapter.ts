import { createClient, type RedisClientType } from "redis";
import type { DbPort, DbScriptArgument, DbScriptOptions } from "@/shared/db/db-port";
import type { DbRecord } from "@/shared/db/db-types";

export interface RedisEnv {
  [key: string]: string | undefined;
  REDIS_URL?: string;
}

export interface RedisClient {
  connect(): Promise<unknown>;
  del(keys: string | string[]): Promise<number>;
  eval(script: string, options?: { keys?: string[]; arguments?: string[] }): Promise<unknown>;
  get(key: string): Promise<string | null>;
  isOpen: boolean;
  quit(): Promise<unknown>;
  set(key: string, value: string): Promise<string | null>;
}

export interface RedisDbOptions {
  client?: RedisClient;
  env?: RedisEnv;
  namespace: string;
  url?: string;
}

const buildItemKey = (namespace: string, id: string) => `${namespace}:${id}`;
const buildScriptKey = (namespace: string, key: string) => `${namespace}:${key}`;

const serializeScriptArgument = (arg: DbScriptArgument): string => {
  if (arg === null) {
    return "";
  }

  return String(arg);
};

const readRedisConfig = (
  options: Pick<RedisDbOptions, "env" | "url">,
) => {
  const url = options.url ?? options.env?.REDIS_URL;

  if (!url?.trim()) {
    throw new Error("REDIS_URL is required for redis adapter.");
  }

  const trimmedUrl = url.trim();

  if (/^https?:\/\//.test(trimmedUrl)) {
    throw new Error(
      `REDIS_URL must start with redis:// or rediss://. Received "${trimmedUrl}".`,
    );
  }

  return {
    url: trimmedUrl,
  };
};

export const createRedisClient = (
  options: Pick<RedisDbOptions, "env" | "url">,
): RedisClient => {
  const config = readRedisConfig(options);

  const client = createClient({
    url: config.url,
  });

  return client as RedisClientType as RedisClient;
};

const ensureConnected = async (client: RedisClient) => {
  if (!client.isOpen) {
    await client.connect();
  }
};

export const createRedisDbAdapter = <TValue>(
  options: RedisDbOptions,
): DbPort<TValue, string> => {
  const client = options.client ?? createRedisClient(options);

  return {
    async set(key, value) {
      await ensureConnected(client);
      await client.set(buildItemKey(options.namespace, key), JSON.stringify(value));
    },
    async get(key) {
      await ensureConnected(client);
      const raw = await client.get(buildItemKey(options.namespace, key));

      return raw ? (JSON.parse(raw) as TValue) : null;
    },
    async del(key) {
      await ensureConnected(client);
      await client.del(buildItemKey(options.namespace, key));
    },
    async script<TResult = unknown>(
      script: string,
      runOptions: DbScriptOptions<string> = {},
    ) {
      await ensureConnected(client);
      const keys = runOptions.keys?.map((key) => buildScriptKey(options.namespace, key)) ?? [];
      const args = runOptions.args?.map(serializeScriptArgument) ?? [];

      const result = await client.eval(script, {
        arguments: args,
        keys,
      });

      return result as TResult;
    },
  };
};

export const disconnectRedisDb = async (client?: RedisClient): Promise<void> => {
  if (!client?.isOpen) {
    return;
  }

  await client.quit();
};

export const seedRedisDb = async <TItem extends DbRecord>(
  options: RedisDbOptions,
  items: TItem[],
): Promise<void> => {
  const db = createRedisDbAdapter<TItem>(options);

  for (const item of items) {
    await db.set(item.id, item);
  }

  if (options.client) {
    await disconnectRedisDb(options.client);
  }
};
