// tests/shared/errors/app-error.test.ts
import { describe, expect, it } from "vitest";
import { AppError, createAppError } from "@/shared/errors/app-error";

describe("AppError", () => {
  it("preserves code and retryability", () => {
    const err = createAppError({
      code: "AUTH_REQUIRED",
      message: "login required",
      retryable: false,
      userVisible: true,
      reportable: false,
      level: "warn",
    });
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe("AUTH_REQUIRED");
    expect(err.retryable).toBe(false);
  });
});
