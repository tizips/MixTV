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
    expect(html).toContain("aria-label=\"播放进度\"");
    expect(html).toContain("title=\"下一集\"");
    expect(html).toContain("title=\"后退 10 秒\"");
    expect(html).toContain("title=\"前进 10 秒\"");
    expect(html).toContain("title=\"声音调节\"");
    expect(html).toContain("0:00 / 45:08");
    expect(html).toContain("title=\"弹幕设置\"");
    expect(html).toContain("title=\"网页全屏\"");
    expect(html).toContain("title=\"全屏\"");
  });
});
