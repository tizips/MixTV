import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PlayPage from "./page";

describe("PlayPage", () => {
  it("renders the playback layout sections", () => {
    const html = renderToStaticMarkup(<PlayPage />);

    expect(html).toContain("星河漫游");
    expect(html).toContain("选集");
    expect(html).toContain("换源");
    expect(html).toContain("收藏");
    expect(html).toContain("片源");
  });
});
