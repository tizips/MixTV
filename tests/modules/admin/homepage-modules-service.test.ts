import { describe, expect, it, vi } from "vitest";
import {
  defaultHomepageConfig,
  getHomepageConfig,
  saveHomepageConfig,
  saveHomepageConfigSwitch,
  type HomepageModulesStore,
} from "@/modules/admin/server/homepage-modules-service";

const createFakeStore = (initial: Record<string, unknown> = {}): HomepageModulesStore => {
  const data = new Map(Object.entries(initial));

  return {
    del: vi.fn(async (key: string) => {
      data.delete(key);
    }),
    get: vi.fn(async (key: string) => data.get(key) ?? null),
    script: vi.fn(async <TResult = unknown>() => ({} as TResult)) as HomepageModulesStore["script"],
    set: vi.fn(async (key: string, value: unknown) => {
      data.set(key, value);
    }),
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
    expect(store.set).toHaveBeenCalledWith("modules", saved);
  });

  it("saves a single homepage module switch", async () => {
    const store = createFakeStore({
      modules: {
        modules: {
          ...defaultHomepageConfig.modules,
          carousel: false,
          "welcome-announcement": true,
          "continue-watching": false,
        },
        updatedAt: "2026-05-13T00:00:00.000Z",
      },
    });

    const saved = await saveHomepageConfigSwitch("carousel", true, store);

    expect(saved.modules.carousel).toBe(true);
    expect(saved.modules["welcome-announcement"]).toBe(true);
    expect(saved.modules["continue-watching"]).toBe(false);
    expect(saved.updatedAt).toEqual(expect.any(String));
    expect(store.set).toHaveBeenCalledWith("modules", saved);
  });
});
