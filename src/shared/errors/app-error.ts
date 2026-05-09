// src/shared/errors/app-error.ts
export type ErrorLevel = "info" | "warn" | "error";

export type AppErrorInput = {
  code: string;
  message: string;
  retryable: boolean;
  userVisible: boolean;
  reportable: boolean;
  level: ErrorLevel;
};

export class AppError extends Error {
  code: string;
  retryable: boolean;
  userVisible: boolean;
  reportable: boolean;
  level: ErrorLevel;

  constructor(input: AppErrorInput) {
    super(input.message);
    this.name = "AppError";
    this.code = input.code;
    this.retryable = input.retryable;
    this.userVisible = input.userVisible;
    this.reportable = input.reportable;
    this.level = input.level;
  }
}

export const createAppError = (input: AppErrorInput): AppError => new AppError(input);
