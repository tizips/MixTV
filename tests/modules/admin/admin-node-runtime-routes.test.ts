import { describe, expect, it } from "vitest";
import * as cacheRoute from "@/app/api/admin/cache/route";
import * as cacheClearRoute from "@/app/api/admin/cache/clear/route";
import * as cacheRefreshRoute from "@/app/api/admin/cache/refresh/route";
import * as migrationExportRoute from "@/app/api/admin/migration/export/route";
import * as migrationImportRoute from "@/app/api/admin/migration/import/route";
import * as performanceRoute from "@/app/api/admin/performance/route";
import * as timingManagementRoute from "@/app/api/admin/timing-management/route";

describe("admin storage-backed routes", () => {
  it("do not force Edge runtime on storage-backed admin routes", () => {
    expect("runtime" in cacheRoute).toBe(false);
    expect("runtime" in cacheClearRoute).toBe(false);
    expect("runtime" in cacheRefreshRoute).toBe(false);
    expect("runtime" in migrationExportRoute).toBe(false);
    expect("runtime" in migrationImportRoute).toBe(false);
    expect("runtime" in performanceRoute).toBe(false);
    expect("runtime" in timingManagementRoute).toBe(false);
  });
});
