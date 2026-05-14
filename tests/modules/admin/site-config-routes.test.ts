import { describe, expect, it } from "vitest";
import * as mainRoute from "@/app/api/admin/site-config/main/route";
import * as readRoute from "@/app/api/admin/site-config/route";
import * as switchRoute from "@/app/api/admin/site-config/switch/route";

describe("site config API routes", () => {
  it("uses the default Node.js runtime for storage-backed handlers", () => {
    expect("runtime" in readRoute ? readRoute.runtime : undefined).not.toBe("edge");
    expect("runtime" in mainRoute ? mainRoute.runtime : undefined).not.toBe("edge");
    expect("runtime" in switchRoute ? switchRoute.runtime : undefined).not.toBe("edge");
  });

  it("rejects unsupported main config fields", async () => {
    const response = await mainRoute.POST(
      new Request("http://localhost/api/admin/site-config/main", {
        body: JSON.stringify({
          doubanAuth: "",
          doubanDataProxyMode: "direct",
          doubanDataProxyUrl: "",
          doubanImageProxyMode: "direct",
          doubanImageProxyUrl: "",
          unexpected: true,
        }),
        method: "POST",
      }),
    );

    await expect(response.json()).resolves.toEqual({ message: "请求体包含不支持的字段。" });
    expect(response.status).toBe(400);
  });

  it("requires a custom proxy URL when the proxy mode is custom", async () => {
    const response = await mainRoute.POST(
      new Request("http://localhost/api/admin/site-config/main", {
        body: JSON.stringify({
          doubanAuth: "",
          doubanDataProxyMode: "custom",
          doubanDataProxyUrl: "",
          doubanImageProxyMode: "direct",
          doubanImageProxyUrl: "",
        }),
        method: "POST",
      }),
    );

    await expect(response.json()).resolves.toEqual({ message: "请输入有效的豆瓣代理地址。" });
    expect(response.status).toBe(400);
  });

  it("rejects unsupported switch fields", async () => {
    const response = await switchRoute.POST(
      new Request("http://localhost/api/admin/site-config/switch", {
        body: JSON.stringify({ key: "enableKeywordFilter", value: true, unexpected: true }),
        method: "POST",
      }),
    );

    await expect(response.json()).resolves.toEqual({ message: "请求体包含不支持的字段。" });
    expect(response.status).toBe(400);
  });

  it("rejects invalid switch keys", async () => {
    const response = await switchRoute.POST(
      new Request("http://localhost/api/admin/site-config/switch", {
        body: JSON.stringify({ key: "unknown", value: true }),
        method: "POST",
      }),
    );

    await expect(response.json()).resolves.toEqual({ message: "key is invalid." });
    expect(response.status).toBe(400);
  });

  it("rejects non-boolean switch values", async () => {
    const response = await switchRoute.POST(
      new Request("http://localhost/api/admin/site-config/switch", {
        body: JSON.stringify({ key: "enableKeywordFilter", value: "true" }),
        method: "POST",
      }),
    );

    await expect(response.json()).resolves.toEqual({ message: "value is required." });
    expect(response.status).toBe(400);
  });
});
