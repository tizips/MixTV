import { describe, expect, it } from "vitest";
import { getMockHomepageData } from "./mock-data-provider";

describe("getMockHomepageData", () => {
  it("returns all homepage sections with mock items", () => {
    const data = getMockHomepageData();

    expect(data.heroBanner).toHaveLength(6);
    expect(data.hotMovies).toHaveLength(12);
    expect(data.hotShortDramas).toHaveLength(10);
  });

  it("returns valid content items with required fields", () => {
    const data = getMockHomepageData();
    
    // Check a movie item has all required fields
    expect(data.hotMovies[0]).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      coverUrl: expect.any(String),
      rating: expect.any(Number),
      year: expect.any(Number),
      type: "movie",
    });
    
    // Check rating is in valid range
    expect(data.hotMovies[0].rating).toBeGreaterThanOrEqual(7.0);
    expect(data.hotMovies[0].rating).toBeLessThanOrEqual(9.5);
    
    // Check year is in valid range
    expect(data.hotMovies[0].year).toBeGreaterThanOrEqual(2020);
    expect(data.hotMovies[0].year).toBeLessThanOrEqual(2026);
    
    // Verify all movies have valid ratings and years
    data.hotMovies.forEach((movie) => {
      expect(movie.rating).toBeGreaterThanOrEqual(7.0);
      expect(movie.rating).toBeLessThanOrEqual(9.5);
      expect(movie.year).toBeGreaterThanOrEqual(2020);
      expect(movie.year).toBeLessThanOrEqual(2026);
    });
    
    // Check hero banner items have required fields
    expect(data.heroBanner[0]).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      backdropUrl: expect.any(String),
      rating: expect.any(Number),
      type: expect.any(String),
    });
    
    // Verify Chinese titles are present
    expect(data.hotMovies[0].title).toMatch(/[\u4e00-\u9fa5]/);
    expect(data.heroBanner[0].title).toMatch(/[\u4e00-\u9fa5]/);
  });
});
