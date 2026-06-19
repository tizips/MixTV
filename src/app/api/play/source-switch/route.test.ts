import { describe, expect, it, vi } from "vitest";
import { runtime } from "./route";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/modules/history/server/history-service", () => ({
  deleteHistoryPlaybackProgress: vi.fn(),
}));

vi.mock("@/modules/playback/server/playback-source-switch-service", () => ({
  PlaybackSourceSwitchValidationError: class PlaybackSourceSwitchValidationError extends Error {},
  switchPlaybackSource: vi.fn(),
}));

vi.mock("@/modules/playback/server/playback-progress-service", () => ({
  createPlaybackProgressStore: vi.fn(),
}));

vi.mock("@/modules/stats", () => ({
  recordApiRequest: vi.fn(),
}));

describe("/api/play/source-switch route", () => {
  it("uses the Node.js runtime for playback source switching", () => {
    expect(runtime).toBe("nodejs");
  });
});
