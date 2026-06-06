import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { auth } from "@/auth";
import { resolveSafeNextPath } from "@/modules/auth/server/redirect";
import { getRuntimeEnv } from "@/shared/runtime-env";

type ProxyRequest = Request & {
  auth?: {
    user?: unknown;
  } | null;
  nextUrl: URL;
  url: string;
};

type AuthCheck = {
  hasApiSession: boolean;
  authenticated: boolean;
  hasPlainToken: boolean;
  hasRequestAuth: boolean;
  hasSecureToken: boolean;
  hasSecret: boolean;
};

const proxyDebugEnvNames = [
  "AUTH_SECRET",
  "AUTH_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "PASSWORD",
  "USERNAME",
];

async function readAuthSecret() {
  const runtimeEnv = await getRuntimeEnv(["AUTH_SECRET", "NEXTAUTH_SECRET"]);

  return runtimeEnv.AUTH_SECRET || runtimeEnv.NEXTAUTH_SECRET || "";
}

function listAuthCookieNames(request: ProxyRequest) {
  const cookieHeader = request.headers.get("cookie") ?? "";

  return cookieHeader
    .split(";")
    .map((part) => part.trim().split("=")[0] ?? "")
    .filter((name) => name.includes("authjs"))
    .join(",");
}

function hasEnv(env: Record<string, string | undefined>, name: string) {
  return env[name] ? "set" : "unset";
}

function safeEnvKeys(env: Record<string, string | undefined>) {
  return proxyDebugEnvNames
    .filter((key) => env[key])
    .sort()
    .join(",");
}

async function addEnvDebugHeaders(response: NextResponse, request: ProxyRequest) {
  if (request.nextUrl.searchParams.get("__proxy_debug") !== "env") {
    return response;
  }

  const runtimeEnv = await getRuntimeEnv(proxyDebugEnvNames);

  response.headers.set("x-mixtv-env-keys", safeEnvKeys(runtimeEnv));
  response.headers.set("x-mixtv-env-auth-secret", hasEnv(runtimeEnv, "AUTH_SECRET"));
  response.headers.set("x-mixtv-env-nextauth-secret", hasEnv(runtimeEnv, "NEXTAUTH_SECRET"));
  response.headers.set("x-mixtv-env-auth-url", hasEnv(runtimeEnv, "AUTH_URL"));
  response.headers.set("x-mixtv-env-nextauth-url", hasEnv(runtimeEnv, "NEXTAUTH_URL"));
  response.headers.set("x-mixtv-env-username", hasEnv(runtimeEnv, "USERNAME"));
  response.headers.set("x-mixtv-env-password", hasEnv(runtimeEnv, "PASSWORD"));

  return response;
}

async function addDebugHeaders(response: NextResponse, request: ProxyRequest, authCheck: AuthCheck) {
  await addEnvDebugHeaders(response, request);

  if (request.nextUrl.searchParams.get("__proxy_debug") !== "1") {
    return response;
  }

  response.headers.set("x-mixtv-proxy-authenticated", authCheck.authenticated ? "1" : "0");
  response.headers.set("x-mixtv-proxy-auth-request", authCheck.hasRequestAuth ? "1" : "0");
  response.headers.set("x-mixtv-proxy-auth-secure-token", authCheck.hasSecureToken ? "1" : "0");
  response.headers.set("x-mixtv-proxy-auth-plain-token", authCheck.hasPlainToken ? "1" : "0");
  response.headers.set("x-mixtv-proxy-auth-api", authCheck.hasApiSession ? "1" : "0");
  response.headers.set("x-mixtv-proxy-auth-secret", authCheck.hasSecret ? "set" : "unset");
  response.headers.set("x-mixtv-proxy-auth-cookies", listAuthCookieNames(request));

  return response;
}

async function checkApiSession(request: ProxyRequest) {
  const sessionResponse = await fetch(new URL("/api/auth/proxy-session", request.url).toString(), {
    cache: "no-store",
    headers: {
      cookie: request.headers.get("cookie") ?? "",
    },
  });

  return sessionResponse.ok;
}

async function checkAuthenticatedSession(request: ProxyRequest): Promise<AuthCheck> {
  if (request.auth?.user) {
    return {
      hasApiSession: false,
      authenticated: true,
      hasPlainToken: false,
      hasRequestAuth: true,
      hasSecret: Boolean(await readAuthSecret()),
      hasSecureToken: false,
    };
  }

  const secret = await readAuthSecret();

  if (!secret) {
    const hasApiSession = await checkApiSession(request);

    return {
      hasApiSession,
      authenticated: hasApiSession,
      hasPlainToken: false,
      hasRequestAuth: false,
      hasSecret: false,
      hasSecureToken: false,
    };
  }

  const secureToken = await getToken({
    req: request,
    secret,
    secureCookie: true,
  });

  if (secureToken) {
    return {
      hasApiSession: false,
      authenticated: true,
      hasPlainToken: false,
      hasRequestAuth: false,
      hasSecret: true,
      hasSecureToken: true,
    };
  }

  const token = await getToken({
    req: request,
    secret,
    secureCookie: false,
  });

  if (!token) {
    const hasApiSession = await checkApiSession(request);

    return {
      hasApiSession,
      authenticated: hasApiSession,
      hasPlainToken: false,
      hasRequestAuth: false,
      hasSecret: true,
      hasSecureToken: false,
    };
  }

  return {
    hasApiSession: false,
    authenticated: true,
    hasPlainToken: true,
    hasRequestAuth: false,
    hasSecret: true,
    hasSecureToken: false,
  };
}

export default auth(async (request) => {
  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith("/api");

  if (isApiRoute) {
    return NextResponse.next();
  }

  const nextPath = resolveSafeNextPath(
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  const authCheck = await checkAuthenticatedSession(request);
  const isAuthenticated = authCheck.authenticated;

  if (pathname === "/login") {
    if (!isAuthenticated) {
      return addDebugHeaders(NextResponse.next(), request, authCheck);
    }

    const redirectTo = resolveSafeNextPath(
      request.nextUrl.searchParams.get("next"),
    );

    return addDebugHeaders(NextResponse.redirect(new URL(redirectTo, request.url)), request, authCheck);
  }

  if (isAuthenticated) {
    return addDebugHeaders(NextResponse.next(), request, authCheck);
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", nextPath);

  return addDebugHeaders(NextResponse.redirect(loginUrl), request, authCheck);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
