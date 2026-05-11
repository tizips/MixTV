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
});
