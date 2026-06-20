import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type EdgeOneSchedule = {
  cron: string;
  method: string;
  name: string;
  path: string;
  timezone: string;
};

type EdgeOneConfig = {
  cloudFunctions?: {
    nodejs?: {
      maxDuration?: number;
    };
  };
  schedules?: EdgeOneSchedule[];
};

async function readEdgeOneConfig() {
  return JSON.parse(
    await readFile(join(process.cwd(), "edgeone.json"), "utf8"),
  ) as EdgeOneConfig;
}

describe("edgeone.json", () => {
  it("runs cron APIs on the requested schedules with the maximum node timeout", async () => {
    const config = await readEdgeOneConfig();

    expect(config.cloudFunctions?.nodejs?.maxDuration).toBe(120);
    expect(config.schedules).toEqual([
      {
        name: "history-update",
        cron: "*/30 * * * *",
        path: "/api/cron/history",
        method: "GET",
        timezone: "Asia/Shanghai",
      },
      {
        name: "subscription-update",
        cron: "0 2 * * *",
        path: "/api/cron/subscription",
        method: "GET",
        timezone: "Asia/Shanghai",
      },
      {
        name: "source-check",
        cron: "0 3 * * *",
        path: "/api/cron/source-check",
        method: "GET",
        timezone: "Asia/Shanghai",
      },
    ]);
  });
});
