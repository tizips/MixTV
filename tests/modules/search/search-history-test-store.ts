import { vi } from "vitest";
import type { DbPort, DbScriptOptions } from "@/shared/db/db-port";

export function createScriptSearchHistoryStore(): DbPort<string, string> {
  const lists = new Map<string, string[]>();

  return {
    del: vi.fn(async (key) => {
      lists.delete(key);
    }),
    get: vi.fn(async () => null),
    async script<TResult = unknown>(script: string, options?: DbScriptOptions<string>) {
      const key = options?.keys?.[0] ?? "";
      const values = lists.get(key) ?? [];
      const stop = Number(options?.args?.at(-1) ?? 19);

      if (script.includes("DEL")) {
        lists.delete(key);

        return [] as TResult;
      }

      if (script.includes("LREM")) {
        const keyword = String(options?.args?.[0] ?? "");
        const nextValues = values.filter((currentValue) => currentValue !== keyword);

        if (script.includes("LPUSH")) {
          nextValues.unshift(keyword);
        }

        lists.set(key, nextValues.slice(0, stop + 1));

        return (lists.get(key) ?? []) as TResult;
      }

      return values.slice(0, stop + 1) as TResult;
    },
    set: vi.fn(),
  };
}
