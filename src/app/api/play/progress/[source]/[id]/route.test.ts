import { describe, expect, it, vi } from "vitest";
import { runtime } from "./route";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/modules/playback/server/playback-progress-service", () => ({
  PlaybackProgressValidationError: class PlaybackProgressValidationError extends Error {},
  savePlaybackProgress: vi.fn(),
}));

vi.mock("@/modules/stats", () => ({
  withApiTraffic: (handler: unknown) => handler,
}));

describe("/api/play/progress/[source]/[id] route", () => {
  it("uses the Node.js runtime", () => {
    expect(runtime).toBe("nodejs");
  });
});
