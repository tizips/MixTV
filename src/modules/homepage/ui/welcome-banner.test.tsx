import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WelcomeBanner } from "./welcome-banner";

describe("WelcomeBanner", () => {
  it("renders the banner content", () => {
    const html = renderToStaticMarkup(<WelcomeBanner userName="橙子" />);

    expect(html).toContain("欢迎回来，橙子");
    expect(html).toContain("探索精彩影视内容");
  });
});
