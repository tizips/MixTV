import { vi } from "vitest";
import type { DbPort, DbScriptOptions } from "@/shared/db/db-port";

export type ScriptFavoriteStore = DbPort<unknown, string> & {
  dumpHash: (key: string) => Record<string, string>;
};

export function createScriptFavoriteStore(): ScriptFavoriteStore {
  const hashes = new Map<string, Record<string, string>>();
  const script: ScriptFavoriteStore["script"] = async <TResult = unknown>(
    scriptSource: string,
    options?: DbScriptOptions<string>,
  ) => {
    const key = options?.keys?.[0] ?? "";
    const field = String(options?.args?.[0] ?? "");
    const value = String(options?.args?.[1] ?? "");
    const hash = hashes.get(key) ?? {};

    if (scriptSource.includes("HDEL")) {
      delete hash[field];
      hashes.set(key, hash);

      return hash as TResult;
    }

    if (scriptSource.includes("HSET")) {
      hash[field] = value;
      hashes.set(key, hash);

      return value as TResult;
    }

    if (scriptSource.includes("HGETALL")) {
      return hash as TResult;
    }

    if (scriptSource.includes("HGET")) {
      return (hash[field] ?? null) as TResult;
    }

    return hash as TResult;
  };

  return {
    del: vi.fn(async (key) => {
      hashes.delete(key);
    }),
    dumpHash(key) {
      return { ...(hashes.get(key) ?? {}) };
    },
    get: vi.fn(async () => null),
    script,
    set: vi.fn(async () => undefined),
  };
}
