import { AdminModuleValidationError } from "./admin-module-error";
import { asObject, now, readString } from "./admin-modules-store";
import { env } from "@/shared/env";

export async function exportMigrationBackup(input: unknown) {
  const payload = asObject(input);
  const password = readString(payload, "password");

  if (!password) {
    throw new AdminModuleValidationError("password is required.");
  }

  return {
    app: env.NEXT_PUBLIC_SITE_NAME,
    version: 1,
    exportedAt: now(),
    includes: ["管理配置", "用户数据", "播放记录", "收藏夹", "想看"],
  };
}

export async function importMigrationBackup(input: unknown) {
  const payload = asObject(input);
  const password = readString(payload, "password");

  if (!password) {
    throw new AdminModuleValidationError("password is required.");
  }

  return { importedAt: now(), message: "Backup import accepted." };
}
