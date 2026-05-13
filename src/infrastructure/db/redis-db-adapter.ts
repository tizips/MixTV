import { createClient, type RedisClientType } from "redis";
import type { DbPort } from "@/shared/db/db-port";
import type { DbRecord } from "@/shared/db/db-types";

export interface RedisDbOptions {
  client?: RedisClientType;
  namespace: string;
  url?: string;
}

const buildItemKey = (namespace: string, id: string) => `${namespace}:item:${id}`;

export const createRedisDbAdapter = <TValue>(
  options: RedisDbOptions,
): DbPort<TValue, string> => {
  const client = options.client ?? createClient({ url: options.url ?? process.env.REDIS_URL });

  async function ensureConnected() {
    if (!client.isOpen) {
      await client.connect();
    }
  }

  return {
    async set(key, value) {
      await ensureConnected();

      await client.set(buildItemKey(options.namespace, key), JSON.stringify(value));
    },
    async get(key) {
      await ensureConnected();

      const raw = await client.get(buildItemKey(options.namespace, key));
      return raw ? (JSON.parse(raw) as TValue) : null;
    },
    async del(key) {
      await ensureConnected();

      await client.del(buildItemKey(options.namespace, key));
    },
  };
};

export const disconnectRedisDb = async (options: RedisDbOptions): Promise<void> => {
  if (!options.client || !options.client.isOpen) {
    return;
  }

  await options.client.quit();
};

export const seedRedisDb = async <TItem extends DbRecord>(
  options: RedisDbOptions,
  items: TItem[],
): Promise<void> => {
  const client = options.client ?? createClient({ url: options.url ?? process.env.REDIS_URL });
  const ownsClient = !options.client;

  if (!client.isOpen) {
    await client.connect();
  }

  const multi = client.multi();

  for (const item of items) {
    multi.set(buildItemKey(options.namespace, item.id), JSON.stringify(item));
  }

  await multi.exec();

  if (ownsClient && client.isOpen) {
    await client.quit();
  }
};
