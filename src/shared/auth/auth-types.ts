// src/shared/auth/auth-types.ts
export type Permission = string;

export type Session = {
  userId: string;
  permissions: Permission[];
};
