import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";
import { config } from "../src/proxy";

function doesProxyMatch(url: string) {
  return unstable_doesMiddlewareMatch({
    config,
    nextConfig,
    url,
  });
}

describe("proxy matcher", () => {
  it("skips API routes so route handlers receive request bodies directly", () => {
    expect(doesProxyMatch("/api/login")).toBe(false);
    expect(doesProxyMatch("/api/play/source-switch")).toBe(false);
    expect(doesProxyMatch("/api/admin/video-source")).toBe(false);
  });

  it("still runs for application pages", () => {
    expect(doesProxyMatch("/")).toBe(true);
    expect(doesProxyMatch("/play?source=alpha&id=1")).toBe(true);
  });
});
