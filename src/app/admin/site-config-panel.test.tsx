import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteConfigPanel } from "./site-config-panel";

describe("SiteConfigPanel", () => {
  it("renders the requested site configuration fields", () => {
    const html = renderToStaticMarkup(<SiteConfigPanel />);

    expect(html).toContain("站点名称");
    expect(html).toContain("站点公告");
    expect(html).toContain("豆瓣数据代理");
    expect(html).toContain("Cors Proxy By Zwei");
    expect(html).toContain("豆瓣图片代理");
    expect(html).toContain("豆瓣官方精品CDN（阿里云）");
    expect(html).toContain("豆瓣认证");
    expect(html).toContain("启用关键词过滤");
    expect(html).toContain("显示成人内容");
    expect(html).toContain("启用流式搜索");
    expect(html).toContain("role=\"switch\"");
    expect(html).toContain("data-slot=\"select\"");
    expect(html).toContain("保存配置");
  });

  it("shows custom proxy inputs when custom modes are selected", () => {
    const html = renderToStaticMarkup(
      <SiteConfigPanel
        initialValues={{
          doubanDataProxyMode: "custom",
          doubanImageProxyMode: "custom",
        }}
      />,
    );

    expect(html).toContain("豆瓣代理地址");
    expect(html).toContain("输入地址");
  });
});
