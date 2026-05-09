import { describe, expect, it } from "vitest";
import { getMockHomepageData } from "./mock-data-provider";

describe("getMockHomepageData", () => {
  it("returns all homepage sections with mock items", () => {
    const data = getMockHomepageData();

    expect(data.heroBanner).toHaveLength(6);
    expect(data.hotMovies).toHaveLength(12);
    expect(data.hotShortDramas).toHaveLength(10);
  });
});
