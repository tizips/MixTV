import { describe, expect, it } from "vitest";
import {
  defaultHomepageConfig,
  getHomepageConfig,
  saveHomepageConfig,
  saveHomepageConfigSwitch,
  type HomepageModulesStore,
} from "@/modules/admin/server/homepage-modules-service";
import {
  createEdgeOneKvHashStore,
  dumpEdgeOneKvHash,
} from "../../helpers/fake-edgeone-kv";

const modulesKey = "modules";

function createFakeStore(hashInitial: Record<string, string> = {}): Promise<HomepageModulesStore> {
  return createEdgeOneKvHashStore({
    [modulesKey]: hashInitial,
  }, { namespace: "admin" });
}

describe("homepage modules service", () => {
  it("reads and saves homepage config", async () => {
    const store = await createFakeStore();
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
    await expect(dumpEdgeOneKvHash(store, modulesKey, { namespace: "admin" })).resolves.toMatchObject({
      "welcome-announcement": "true",
      carousel: "false",
      "continue-watching": "true",
      updatedAt: saved.updatedAt,
    });
  });

  it("saves a single homepage module switch", async () => {
    const store = await createFakeStore({
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
    await expect(dumpEdgeOneKvHash(store, modulesKey, { namespace: "admin" })).resolves.toMatchObject({
      carousel: "true",
      "welcome-announcement": "true",
      "continue-watching": "false",
      updatedAt: saved.updatedAt,
    });
  });

  it("reads stored hash values", async () => {
    const store = await createFakeStore({
      "welcome-announcement": "false",
      carousel: "true",
      "continue-watching": "false",
      "coming-soon": "true",
      "trending-movies": "true",
      "trending-series": "false",
      "new-anime": "true",
      "trending-variety": "false",
      "trending-short-dramas": "true",
      updatedAt: "2026-05-15T00:00:00.000Z",
    });

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
  });
});
