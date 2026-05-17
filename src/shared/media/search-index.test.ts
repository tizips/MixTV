import { describe, expect, it } from "vitest";
import { createMediaSearchIndex, normalizeMediaSearchType } from "./search-index";

describe("media search index", () => {
  it("normalizes common chinese types to english tokens", () => {
    expect(normalizeMediaSearchType("电影")).toBe("movie");
    expect(normalizeMediaSearchType("电视剧")).toBe("tv");
    expect(normalizeMediaSearchType("动漫")).toBe("anime");
    expect(normalizeMediaSearchType("综艺")).toBe("variety");
  });

  it("builds a stable year:type:title index", () => {
    expect(
      createMediaSearchIndex({
        title: " 庆余年 第二季 ",
        typeName: "电视剧",
        year: "2024",
      }),
    ).toBe("2024:tv:庆余年第二季");
  });
});
