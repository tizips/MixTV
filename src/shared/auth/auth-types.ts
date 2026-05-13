// src/shared/auth/auth-types.ts
export type Permission = string;

export type Session = {
  admin: boolean;
  id: string;
  name: string;
};
