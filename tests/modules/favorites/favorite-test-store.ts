import { vi } from "vitest";
import type { DbPort, DbScriptOptions } from "@/shared/db/db-port";

export type ScriptFavoriteStore = DbPort<unknown, string> & {
  dumpHash: (key: string) => Record<string, string>;
};

export function createScriptFavoriteStore(): ScriptFavoriteStore {
  const hashes = new Map<string, Record<string, string>>();

  return {
    del: vi.fn(async (key) => {
      hashes.delete(key);
    }),
    dumpHash(key) {
      return { ...(hashes.get(key) ?? {}) };
    },
    get: vi.fn(async () => null),
    async script<TResult = unknown>(script: string, options?: DbScriptOptions<string>) {
      const key = options?.keys?.[0] ?? "";
      const field = String(options?.args?.[0] ?? "");
      const value = String(options?.args?.[1] ?? "");
      const hash = hashes.get(key) ?? {};

      if (script.includes("HDEL")) {
        delete hash[field];
        hashes.set(key, hash);

        return hash as TResult;
      }

      if (script.includes("HSET")) {
        hash[field] = value;
        hashes.set(key, hash);

        return value as TResult;
      }

      return hash as TResult;
    },
    set: vi.fn(async () => undefined),
  };
}
