import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AdminPage from "@/app/admin/page";

describe("AdminPage", () => {
  it("renders a HeroUI tabbed admin shell", async () => {
    const html = renderToStaticMarkup(<AdminPage />);

    expect(html).toContain("管理面板");
    expect(html).toContain("站点运营仪表盘");
    expect(html).toContain("role=\"tablist\"");
    expect(html).toContain("role=\"tab\"");
    expect(html).toContain("配置文件");
    expect(html).toContain("站点配置");
    expect(html).toContain("首页模块");
    expect(html).toContain("性能监控");
    expect(html).toContain("站点状态");
    expect(html).toContain("自动更新关闭");
    expect(html).toContain("同步状态");
    expect(html).toContain("拉取配置");
  });

  it("places subscription metadata and pull action beside the requested fields", async () => {
    const html = renderToStaticMarkup(<AdminPage />);
    const configPanelHtml = html.slice(html.indexOf("订阅配置"), html.indexOf("同步状态"));
    const configContentHtml = configPanelHtml.slice(configPanelHtml.indexOf('for="config-content"'));

    expect(configPanelHtml.indexOf("订阅链接")).toBeLessThan(configPanelHtml.indexOf("最后更新时间"));
    expect(configPanelHtml.indexOf("最后更新时间")).toBeLessThan(configPanelHtml.indexOf("输入订阅链接"));
    expect(configPanelHtml.indexOf("输入订阅链接")).toBeLessThan(configPanelHtml.indexOf("拉取配置"));
    expect(configPanelHtml.indexOf("拉取配置")).toBeLessThan(configPanelHtml.indexOf("输入配置文件的订阅地址"));
    expect(configPanelHtml.indexOf("输入配置文件的订阅地址")).toBeLessThan(configPanelHtml.indexOf("开启后可自动同步订阅内容"));
    expect(configPanelHtml.indexOf("开启后可自动同步订阅内容")).toBeLessThan(configPanelHtml.indexOf("配置内容"));
    expect(configPanelHtml.indexOf("输入配置文件的订阅地址")).toBeLessThan(configPanelHtml.indexOf("配置内容"));
    expect(configContentHtml.indexOf("配置内容")).toBeLessThan(configContentHtml.indexOf("保存"));
    expect(html).not.toContain("同步状态");
    expect(html).not.toContain("快捷动作");
  });

  it("renders admin tabs as a left sidebar beside the active panel", async () => {
    const html = renderToStaticMarkup(<AdminPage />);

    expect(html).toContain("lg:grid-cols-[220px_minmax(0,1fr)]");
    expect(html).toContain("lg:sticky");
    expect(html).toContain("lg:flex-col");
    expect(html).toContain("w-full justify-start");
    expect(html.indexOf("tabs__list-container")).toBeLessThan(html.indexOf("tabs__panel"));
    expect(html).toContain("bg-background/70 p-2 shadow-sm lg:sticky");
    expect(html).toContain("bg-transparent");
    expect(html).not.toContain("overflow-x-auto rounded-2xl");
  });
});
