import { describe, expect, it } from "vitest";
import { mapBooleanConfig } from "./boolean-config";

describe("mapBooleanConfig", () => {
  it("maps boolean flags using the provided key mapping", () => {
    const result = mapBooleanConfig(
      {
        carousel: false,
        "coming-soon": true,
        "continue-watching": true,
      },
      {
        showHeroBanner: "carousel",
        showUpcomingReleases: "coming-soon",
        showContinueWatching: "continue-watching",
      },
    );

    expect(result).toEqual({
      showContinueWatching: true,
      showHeroBanner: false,
      showUpcomingReleases: true,
    });
  });
});
