import { Redis } from "@upstash/redis";
import type { DbPort, DbScriptArgument, DbScriptOptions } from "@/shared/db/db-port";
import type { DbRecord } from "@/shared/db/db-types";

export interface UpstashEnv {
  [key: string]: string | undefined;
  UPSTASH_REDIS_REST_TOKEN?: string;
  UPSTASH_REDIS_REST_URL?: string;
}

export interface UpstashRedisClient {
  del(...keys: string[]): Promise<number>;
  eval(script: string, keys: string[], args: unknown[]): Promise<unknown>;
  evalRo(script: string, keys: string[], args: unknown[]): Promise<unknown>;
  get<TResult = string>(key: string): Promise<TResult | null>;
  set(key: string, value: string): Promise<string | null>;
}

export interface UpstashDbOptions {
  client?: UpstashRedisClient;
  env?: UpstashEnv;
  namespace: string;
  token?: string;
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

const readUpstashRedisConfig = (
  options: Pick<UpstashDbOptions, "env" | "token" | "url">,
) => {
  const url = options.url ?? options.env?.UPSTASH_REDIS_REST_URL;
  const token = options.token ?? options.env?.UPSTASH_REDIS_REST_TOKEN;

  if (!url?.trim() || !token?.trim()) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required for Edge-compatible Redis storage.",
    );
  }

  const trimmedUrl = url.trim();

  if (!/^https?:\/\//.test(trimmedUrl)) {
    throw new Error(
      `Redis REST URL must start with http:// or https://. Received "${trimmedUrl}". Raw Redis TCP URLs are not supported in Edge-compatible routes.`,
    );
  }

  return {
    token: token.trim(),
    url: trimmedUrl,
  };
};

export const createUpstashRedisClient = (
  options: Pick<UpstashDbOptions, "env" | "token" | "url">,
): UpstashRedisClient => {
  const config = readUpstashRedisConfig(options);

  return new Redis({
    automaticDeserialization: false,
    token: config.token,
    url: config.url,
  });
};

export const createUpstashDbAdapter = <TValue>(
  options: UpstashDbOptions,
): DbPort<TValue, string> => {
  const client = options.client ?? createUpstashRedisClient(options);

  return {
    async set(key, value) {
      await client.set(buildItemKey(options.namespace, key), JSON.stringify(value));
    },
    async get(key) {
      const raw = await client.get<string>(buildItemKey(options.namespace, key));

      return raw ? (JSON.parse(raw) as TValue) : null;
    },
    async del(key) {
      await client.del(buildItemKey(options.namespace, key));
    },
    async script<TResult = unknown>(
      script: string,
      runOptions: DbScriptOptions<string> = {},
    ) {
      const keys = runOptions.keys?.map((key) => buildScriptKey(options.namespace, key)) ?? [];
      const args = runOptions.args?.map(serializeScriptArgument) ?? [];

      const result = runOptions.readOnly
        ? await client.evalRo(script, keys, args)
        : await client.eval(script, keys, args);

      return result as TResult;
    },
  };
};

export const disconnectUpstashDb = async (): Promise<void> => {
  // Upstash Redis uses HTTP requests and has no persistent connection to close.
};

export const seedUpstashDb = async <TItem extends DbRecord>(
  options: UpstashDbOptions,
  items: TItem[],
): Promise<void> => {
  const db = createUpstashDbAdapter<TItem>(options);

  for (const item of items) {
    await db.set(item.id, item);
  }
};
