import { beforeEach, describe, expect, it, vi } from "vitest";
import middleware, { config } from "./proxy";

const authMock = vi.hoisted(() => vi.fn((handler: unknown) => handler));

vi.mock("@/auth", () => ({
  auth: authMock,
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

describe("middleware", () => {
  beforeEach(() => {
    authMock.mockClear();
  });

  it("redirects unauthenticated home requests to /login", async () => {
    const response = await middleware(createRequest("/", null) as never);
    const location = new URL(response.headers.get("location") ?? "");

    expect(response.status).toBe(307);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/");
  });

  it("allows authenticated home requests through", async () => {
    const response = await middleware(createRequest("/", { user: { id: "user-1" } }) as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("passes protected api requests through to route-level auth", async () => {
    const response = await middleware(createRequest("/api/history", null) as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("allows public api routes without a session", async () => {
    const response = await middleware(createRequest("/api/login", null) as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("allows account lookups without a session so credentials sign-in can validate bearer tokens", async () => {
    const response = await middleware(createRequest("/api/account", null) as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects authenticated visitors away from /login using the next query", async () => {
    const response = await middleware(
      createRequest("/login?next=/stats", { user: { id: "user-1" } }) as never,
    );
    const location = new URL(response.headers.get("location") ?? "");

    expect(response.status).toBe(307);
    expect(location.pathname).toBe("/stats");
  });

  it("normalizes unsafe next values on /login", async () => {
    const response = await middleware(
      createRequest("/login?next=//evil.example", { user: { id: "user-1" } }) as never,
    );
    const location = new URL(response.headers.get("location") ?? "");

    expect(response.status).toBe(307);
    expect(location.pathname).toBe("/");
  });
});

describe("middleware config", () => {
  it("matches page routes and excludes static assets", () => {
    expect(config.matcher).toEqual(["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"]);
  });
});
