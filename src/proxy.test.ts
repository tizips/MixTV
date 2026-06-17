import { beforeEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "./proxy";

const authMock = vi.hoisted(() => vi.fn((handler: unknown) => handler));
const getTokenMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());
const testProxy = proxy as unknown as (
  request: never,
  event: never,
) => Promise<Response> | Response;

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("next-auth/jwt", () => ({
  getToken: getTokenMock,
}));

function createRequest(pathname: string, authState: unknown = null) {
  const url = new URL(pathname, "http://localhost");

  return {
    auth: authState,
    headers: new Headers(),
    nextUrl: url,
    url: url.toString(),
  };
}

async function runProxy(pathname: string, authState: unknown = null) {
  return runProxyRequest(createRequest(pathname, authState));
}

async function runProxyRequest(request: ReturnType<typeof createRequest>) {
  return testProxy(request as never, undefined as never);
}

describe("proxy", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    authMock.mockClear();
    getTokenMock.mockReset();
    getTokenMock.mockResolvedValue(null);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  it("redirects unauthenticated home requests to /login", async () => {
    const response = await runProxy("/", null);
    const location = new URL(response.headers.get("location") ?? "");

    expect(response.status).toBe(307);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/");
  });

  it("prevents edge caches from reusing auth-dependent page redirects", async () => {
    const response = await runProxy("/", null);

    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")?.toLowerCase().split(/\s*,\s*/)).toContain("cookie");
  });

  it("allows authenticated home requests through", async () => {
    const response = await runProxy("/", { user: { id: "user-1" } });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("allows page requests when the Auth.js session token is valid", async () => {
    vi.stubEnv("AUTH_SECRET", "test-secret");
    getTokenMock.mockResolvedValue({ id: "user-1" });

    const response = await runProxy("/", null);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("checks both secure and non-secure Auth.js session cookie names", async () => {
    vi.stubEnv("AUTH_SECRET", "test-secret");
    getTokenMock.mockResolvedValueOnce(null);
    getTokenMock.mockResolvedValueOnce({ id: "user-1" });

    const response = await runProxy("/", null);

    expect(response.status).toBe(200);
    expect(getTokenMock).toHaveBeenCalledTimes(2);
    expect(getTokenMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ secureCookie: true }));
    expect(getTokenMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ secureCookie: false }));
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("falls back to the API session checker when auth env is unavailable", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const response = await runProxyRequest({
      ...createRequest("/?__proxy_debug=1", null),
      headers: new Headers({
        cookie: "__Secure-authjs.session-token=redacted",
      }),
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("/api/auth/proxy-session", "http://localhost").toString(),
      {
        cache: "no-store",
        headers: {
          cookie: "__Secure-authjs.session-token=redacted",
        },
      },
    );
    expect(getTokenMock).not.toHaveBeenCalled();
    expect(response.headers.get("x-mixtv-proxy-auth-api")).toBe("1");
  });

  it("adds proxy auth diagnostics when requested", async () => {
    vi.stubEnv("AUTH_SECRET", "test-secret");
    getTokenMock.mockResolvedValueOnce(null);
    getTokenMock.mockResolvedValueOnce({ id: "user-1" });

    const response = await runProxyRequest({
      ...createRequest("/?__proxy_debug=1", null),
      headers: new Headers({
        cookie: "__Secure-authjs.session-token=redacted; theme=dark",
      }),
    });

    expect(response.headers.get("x-mixtv-proxy-authenticated")).toBe("1");
    expect(response.headers.get("x-mixtv-proxy-auth-request")).toBe("0");
    expect(response.headers.get("x-mixtv-proxy-auth-secure-token")).toBe("0");
    expect(response.headers.get("x-mixtv-proxy-auth-plain-token")).toBe("1");
    expect(response.headers.get("x-mixtv-proxy-auth-api")).toBe("0");
    expect(response.headers.get("x-mixtv-proxy-auth-secret")).toBe("set");
    expect(response.headers.get("x-mixtv-proxy-auth-cookies")).toBe("__Secure-authjs.session-token");
  });

  it("adds sanitized environment diagnostics when requested", async () => {
    vi.stubEnv("AUTH_SECRET", "test-secret");
    vi.stubEnv("USERNAME", "admin");
    vi.stubEnv("NEXT_PUBLIC_SITE_NAME", "MixTV");

    const response = await runProxy("/?__proxy_debug=env", null);

    expect(response.headers.get("x-mixtv-env-auth-secret")).toBe("set");
    expect(response.headers.get("x-mixtv-env-username")).toBe("set");
    expect(response.headers.get("x-mixtv-env-password")).toBe("unset");
    expect(response.headers.get("x-mixtv-env-next-public-site-name")).toBe("set");
    expect(response.headers.get("x-mixtv-env-keys")).toContain("AUTH_SECRET");
    expect(response.headers.get("x-mixtv-env-keys")).toContain("NEXT_PUBLIC_SITE_NAME");

    vi.unstubAllEnvs();
  });

  it("passes protected api requests through to route-level auth", async () => {
    const response = await runProxy("/api/history", null);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("allows public api routes without a session", async () => {
    const response = await runProxy("/api/login", null);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("allows account lookups without a session so credentials sign-in can validate bearer tokens", async () => {
    const response = await runProxy("/api/account", null);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects authenticated visitors away from /login using the next query", async () => {
    const response = await runProxy("/login?next=/stats", { user: { id: "user-1" } });
    const location = new URL(response.headers.get("location") ?? "");

    expect(response.status).toBe(307);
    expect(location.pathname).toBe("/stats");
  });

  it("normalizes unsafe next values on /login", async () => {
    const response = await runProxy("/login?next=//evil.example", { user: { id: "user-1" } });
    const location = new URL(response.headers.get("location") ?? "");

    expect(response.status).toBe(307);
    expect(location.pathname).toBe("/");
  });
});

describe("proxy config", () => {
  function matchesProxy(pathname: string) {
    return new RegExp(`^${config.matcher[0]}$`).test(pathname);
  }

  it("matches page routes and excludes static assets plus the auth session checker", () => {
    expect(config.matcher).toEqual([
      "/((?!api/auth/proxy-session(?:/|$)|_next/static|_next/image|favicon.ico|.*\\..*).*)",
    ]);
    expect(matchesProxy("/")).toBe(true);
    expect(matchesProxy("/api/history")).toBe(true);
    expect(matchesProxy("/api/auth/proxy-session")).toBe(false);
    expect(matchesProxy("/_next/static/chunk.js")).toBe(false);
    expect(matchesProxy("/favicon.ico")).toBe(false);
  });
});
