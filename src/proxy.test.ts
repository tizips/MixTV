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

  it("passes unauthenticated page requests through without session checks", async () => {
    const response = await runProxy("/", null);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(getTokenMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes authenticated page requests through without session checks", async () => {
    const response = await runProxy("/", { user: { id: "user-1" } });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(getTokenMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores proxy auth diagnostics while middleware auth is disabled", async () => {
    vi.stubEnv("AUTH_SECRET", "test-secret");

    const response = await runProxyRequest({
      ...createRequest("/?__proxy_debug=1", null),
      headers: new Headers({
        cookie: "__Secure-authjs.session-token=redacted; theme=dark",
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-mixtv-proxy-authenticated")).toBeNull();
    expect(response.headers.get("x-mixtv-env-auth-secret")).toBeNull();
    expect(getTokenMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
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

  it("passes login requests through", async () => {
    const response = await runProxy("/login?next=/stats", { user: { id: "user-1" } });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(getTokenMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("proxy config", () => {
  function matchesProxy(pathname: string) {
    return new RegExp(`^${config.matcher[0]}$`).test(pathname);
  }

  it("matches page routes and excludes API routes plus static assets", () => {
    expect(config.matcher).toEqual([
      "/((?!api(?:/|$)|_next/static|_next/image|favicon.ico|.*\\..*).*)",
    ]);
    expect(matchesProxy("/")).toBe(true);
    expect(matchesProxy("/api/history")).toBe(false);
    expect(matchesProxy("/api/play/source-switch")).toBe(false);
    expect(matchesProxy("/api/auth/proxy-session")).toBe(false);
    expect(matchesProxy("/_next/static/chunk.js")).toBe(false);
    expect(matchesProxy("/favicon.ico")).toBe(false);
  });
});
