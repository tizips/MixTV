// src/modules/auth/index.ts
export { hasPermission } from "./domain/permissions";
export type { AuthService } from "./application/auth-service";
export { resolveSafeNextPath } from "./server/redirect";
