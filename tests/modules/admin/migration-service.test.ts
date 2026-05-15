import { describe, expect, it } from "vitest";
import {
  exportMigrationBackup,
  importMigrationBackup,
} from "@/modules/admin/server/migration-service";

describe("migration service", () => {
  it("exports and imports migration backups", async () => {
    await expect(exportMigrationBackup({ password: "secret" })).resolves.toMatchObject({
      app: "MixTV",
      version: 1,
    });
    await expect(importMigrationBackup({ password: "secret" })).resolves.toMatchObject({
      message: "Backup import accepted.",
    });
  });
});
