// src/modules/auth/domain/permissions.ts
import type { Permission } from "@/shared/auth/auth-types";

export const hasPermission = (permissions: Permission[], expected: Permission): boolean =>
  permissions.includes(expected);
