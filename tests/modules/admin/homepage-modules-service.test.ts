import { describe, expect, it, vi } from "vitest";
import {
  defaultHomepageConfig,
  getHomepageConfig,
  saveHomepageConfig,
  saveHomepageConfigSwitch,
  type HomepageModulesStore,
} from "@/modules/admin/server/homepage-modules-service";

const createFakeStore = (hashInitial: Record<string, string> = {}): HomepageModulesStore => {
  const hash = new Map(Object.entries(hashInitial));

  return {
    del: vi.fn(async () => undefined),
    get: vi.fn(async () => null),
    script: vi.fn(async <TResult = unknown>(script: string, options = {}) => {
      const runOptions = options as { args?: unknown[] };

      if (script.includes("HGETALL")) {
        return Object.fromEntries(hash) as TResult;
      }

      if (script.includes("HSET")) {
        const args = runOptions.args ?? [];

        for (let index = 0; index < args.length; index += 2) {
          const field = args[index];
          const value = args[index + 1];

          if (typeof field === "string" && typeof value === "string") {
            hash.set(field, value);
          }
        }

        return 1 as TResult;
      }

      return {} as TResult;
    }) as HomepageModulesStore["script"],
    set: vi.fn(async () => undefined),
  };
};

describe("homepage modules service", () => {
  it("reads and saves homepage config", async () => {
    const store = createFakeStore();
    expect(defaultHomepageConfig.modules).toHaveProperty("welcome-announcement", true);
    await expect(getHomepageConfig(store)).resolves.toEqual(defaultHomepageConfig);

    const saved = await saveHomepageConfig(
      {
        modules: {
          ...defaultHomepageConfig.modules,
          carousel: false,
          "welcome-announcement": true,
        },
      },
      store,
    );

    expect(saved.modules.carousel).toBe(false);
    expect(saved.updatedAt).toEqual(expect.any(String));
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HSET"), {
      args: [
        "true",
        "false",
        "true",
        "true",
        "true",
        "true",
        "true",
        "true",
        "true",
        saved.updatedAt,
      ],
      keys: ["modules"],
    });
  });

  it("saves a single homepage module switch", async () => {
    const store = createFakeStore({
      carousel: "false",
      "welcome-announcement": "true",
      "continue-watching": "false",
      updatedAt: "2026-05-13T00:00:00.000Z",
    });

    const saved = await saveHomepageConfigSwitch("carousel", true, store);

    expect(saved.modules.carousel).toBe(true);
    expect(saved.modules["welcome-announcement"]).toBe(true);
    expect(saved.modules["continue-watching"]).toBe(false);
    expect(saved.updatedAt).toEqual(expect.any(String));
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HSET"), {
      args: [
        "true",
        "true",
        "false",
        "true",
        "true",
        "true",
        "true",
        "true",
        "true",
        saved.updatedAt,
      ],
      keys: ["modules"],
    });
  });

  it("reads hgetall array responses", async () => {
    const store = {
      del: vi.fn(async () => undefined),
      get: vi.fn(async () => null),
      script: vi.fn(async <TResult = unknown>() => [
        "welcome-announcement",
        "false",
        "carousel",
        "true",
        "continue-watching",
        "false",
        "coming-soon",
        "true",
        "trending-movies",
        "true",
        "trending-series",
        "false",
        "new-anime",
        "true",
        "trending-variety",
        "false",
        "trending-short-dramas",
        "true",
        "updatedAt",
        "2026-05-15T00:00:00.000Z",
      ] as TResult) as HomepageModulesStore["script"],
      set: vi.fn(async () => undefined),
    } satisfies HomepageModulesStore;

    await expect(getHomepageConfig(store)).resolves.toEqual({
      modules: {
        "welcome-announcement": false,
        carousel: true,
        "continue-watching": false,
        "coming-soon": true,
        "trending-movies": true,
        "trending-series": false,
        "new-anime": true,
        "trending-variety": false,
        "trending-short-dramas": true,
      },
      updatedAt: "2026-05-15T00:00:00.000Z",
    });
    expect(store.get).not.toHaveBeenCalled();
  });
});
