// src/modules/auth/application/auth-service.ts
import type { Session } from "@/shared/auth/auth-types";

export interface AuthService {
  getSession(): Promise<Session | null>;
  login(username: string, password: string): Promise<Session>;
  logout(): Promise<void>;
}
