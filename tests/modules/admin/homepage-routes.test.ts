import { describe, expect, it } from "vitest";
import * as readRoute from "@/app/api/admin/homepage/route";
import * as switchRoute from "@/app/api/admin/homepage/switch/route";

describe("homepage config API routes", () => {
  it("uses the default Node.js runtime for storage-backed handlers", () => {
    expect("runtime" in readRoute ? readRoute.runtime : undefined).not.toBe("edge");
    expect("runtime" in switchRoute ? switchRoute.runtime : undefined).not.toBe("edge");
  });

  it("rejects unsupported switch fields", async () => {
    const response = await switchRoute.POST(
      new Request("http://localhost/api/admin/homepage/switch", {
        body: JSON.stringify({ key: "carousel", value: true, unexpected: true }),
        method: "POST",
      }),
    );

    await expect(response.json()).resolves.toEqual({ message: "请求体包含不支持的字段。" });
    expect(response.status).toBe(400);
  });

  it("rejects invalid switch keys", async () => {
    const response = await switchRoute.POST(
      new Request("http://localhost/api/admin/homepage/switch", {
        body: JSON.stringify({ key: "unknown", value: true }),
        method: "POST",
      }),
    );

    await expect(response.json()).resolves.toEqual({ message: "key is invalid." });
    expect(response.status).toBe(400);
  });

  it("rejects non-boolean switch values", async () => {
    const response = await switchRoute.POST(
      new Request("http://localhost/api/admin/homepage/switch", {
        body: JSON.stringify({ key: "carousel", value: "true" }),
        method: "POST",
      }),
    );

    await expect(response.json()).resolves.toEqual({ message: "value is required." });
    expect(response.status).toBe(400);
  });
});
