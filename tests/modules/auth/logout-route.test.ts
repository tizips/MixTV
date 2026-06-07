import { describe, expect, it } from "vitest";
import * as logoutRoute from "@/app/api/logout/route";

describe("logout API route", () => {
  it("uses the Node.js runtime", () => {
    expect(logoutRoute.runtime).toBe("nodejs");
  });

  it("clears both Auth.js session cookie variants without reading a request body", async () => {
    const response = await logoutRoute.POST(
      new Request("https://tv.herhu.com/api/logout", {
        body: "this body should not be read",
        method: "POST",
      }),
    );

    expect(response.status).toBe(204);
    const setCookieHeaders = response.headers.getSetCookie();
    const plainCookie = setCookieHeaders.find((header) =>
      header.startsWith("authjs.session-token="),
    );
    const secureCookie = setCookieHeaders.find((header) =>
      header.startsWith("__Secure-authjs.session-token="),
    );

    expect(plainCookie).toContain("Max-Age=0");
    expect(plainCookie).toContain("Path=/");
    expect(plainCookie).toContain("HttpOnly");
    expect(plainCookie).toContain("SameSite=lax");
    expect(plainCookie).not.toContain("Secure");
    expect(secureCookie).toContain("Max-Age=0");
    expect(secureCookie).toContain("Path=/");
    expect(secureCookie).toContain("HttpOnly");
    expect(secureCookie).toContain("Secure");
    expect(secureCookie).toContain("SameSite=lax");
  });
});
