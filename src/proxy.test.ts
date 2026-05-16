import { beforeEach, describe, expect, it, vi } from "vitest";
import proxy, { config } from "./proxy";

const authMock = vi.hoisted(() => vi.fn((handler: unknown) => handler));
const getTokenMock = vi.hoisted(() => vi.fn());

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
  return (await proxy(createRequest(pathname, authState) as never, undefined as never)) as Response;
}

describe("proxy", () => {
  beforeEach(() => {
    authMock.mockClear();
    getTokenMock.mockReset();
    getTokenMock.mockResolvedValue(null);
  });

  it("redirects unauthenticated home requests to /login", async () => {
    const response = await runProxy("/", null);
    const location = new URL(response.headers.get("location") ?? "");

    expect(response.status).toBe(307);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/");
  });

  it("allows authenticated home requests through", async () => {
    const response = await runProxy("/", { user: { id: "user-1" } });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("allows page requests when the Auth.js session token is valid", async () => {
    getTokenMock.mockResolvedValue({ id: "user-1" });

    const response = await runProxy("/", null);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("checks both secure and non-secure Auth.js session cookie names", async () => {
    getTokenMock.mockResolvedValueOnce(null);
    getTokenMock.mockResolvedValueOnce({ id: "user-1" });

    const response = await runProxy("/", null);

    expect(response.status).toBe(200);
    expect(getTokenMock).toHaveBeenCalledTimes(2);
    expect(getTokenMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ secureCookie: true }));
    expect(getTokenMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ secureCookie: false }));
  });

  it("adds proxy auth diagnostics when requested", async () => {
    getTokenMock.mockResolvedValueOnce(null);
    getTokenMock.mockResolvedValueOnce({ id: "user-1" });

    const response = await proxy({
      ...createRequest("/?__proxy_debug=1", null),
      headers: new Headers({
        cookie: "__Secure-authjs.session-token=redacted; theme=dark",
      }),
    } as never);

    expect(response.headers.get("x-mixtv-proxy-authenticated")).toBe("1");
    expect(response.headers.get("x-mixtv-proxy-auth-request")).toBe("0");
    expect(response.headers.get("x-mixtv-proxy-auth-secure-token")).toBe("0");
    expect(response.headers.get("x-mixtv-proxy-auth-plain-token")).toBe("1");
    expect(response.headers.get("x-mixtv-proxy-auth-secret")).toBe("unset");
    expect(response.headers.get("x-mixtv-proxy-auth-cookies")).toBe("__Secure-authjs.session-token");
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
  it("matches page routes and excludes static assets", () => {
    expect(config.matcher).toEqual(["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"]);
  });
});
