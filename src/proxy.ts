import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { auth } from "@/auth";
import { resolveSafeNextPath } from "@/modules/auth/server/redirect";

type ProxyRequest = Request & {
  auth?: {
    user?: unknown;
  } | null;
  nextUrl: URL;
  url: string;
};

type AuthCheck = {
  authenticated: boolean;
  hasPlainToken: boolean;
  hasRequestAuth: boolean;
  hasSecureToken: boolean;
  hasSecret: boolean;
};

function readAuthSecret() {
  return process.env.AUTH_SECRET || "mixtv-development-auth-secret";
}

function listAuthCookieNames(request: ProxyRequest) {
  const cookieHeader = request.headers.get("cookie") ?? "";

  return cookieHeader
    .split(";")
    .map((part) => part.trim().split("=")[0] ?? "")
    .filter((name) => name.includes("authjs"))
    .join(",");
}

function hasEnv(name: string) {
  return process.env[name] ? "set" : "unset";
}

function safeEnvKeys() {
  return Object.keys(process.env)
    .filter((key) => key.startsWith("NEXT_") || [
      "AUTH_SECRET",
      "AUTH_URL",
      "NEXTAUTH_SECRET",
      "NEXTAUTH_URL",
      "NODE_ENV",
      "PASSWORD",
      "REDIS_URL",
      "STORAGE_TYPE",
      "UPSTASH_REDIS_REST_TOKEN",
      "UPSTASH_REDIS_REST_URL",
      "USERNAME",
    ].includes(key))
    .sort()
    .join(",");
}

function addEnvDebugHeaders(response: NextResponse, request: ProxyRequest) {
  if (request.nextUrl.searchParams.get("__proxy_debug") !== "env") {
    return response;
  }

  response.headers.set("x-mixtv-env-keys", safeEnvKeys());
  response.headers.set("x-mixtv-env-auth-secret", hasEnv("AUTH_SECRET"));
  response.headers.set("x-mixtv-env-nextauth-secret", hasEnv("NEXTAUTH_SECRET"));
  response.headers.set("x-mixtv-env-auth-url", hasEnv("AUTH_URL"));
  response.headers.set("x-mixtv-env-nextauth-url", hasEnv("NEXTAUTH_URL"));
  response.headers.set("x-mixtv-env-username", hasEnv("USERNAME"));
  response.headers.set("x-mixtv-env-password", hasEnv("PASSWORD"));
  response.headers.set("x-mixtv-env-storage-type", hasEnv("STORAGE_TYPE"));
  response.headers.set("x-mixtv-env-redis-url", hasEnv("REDIS_URL"));
  response.headers.set("x-mixtv-env-upstash-url", hasEnv("UPSTASH_REDIS_REST_URL"));
  response.headers.set("x-mixtv-env-upstash-token", hasEnv("UPSTASH_REDIS_REST_TOKEN"));
  response.headers.set("x-mixtv-env-next-public-site-name", hasEnv("NEXT_PUBLIC_SITE_NAME"));
  response.headers.set("x-mixtv-env-node-env", hasEnv("NODE_ENV"));

  return response;
}

function addDebugHeaders(response: NextResponse, request: ProxyRequest, authCheck: AuthCheck) {
  addEnvDebugHeaders(response, request);

  if (request.nextUrl.searchParams.get("__proxy_debug") !== "1") {
    return response;
  }

  response.headers.set("x-mixtv-proxy-authenticated", authCheck.authenticated ? "1" : "0");
  response.headers.set("x-mixtv-proxy-auth-request", authCheck.hasRequestAuth ? "1" : "0");
  response.headers.set("x-mixtv-proxy-auth-secure-token", authCheck.hasSecureToken ? "1" : "0");
  response.headers.set("x-mixtv-proxy-auth-plain-token", authCheck.hasPlainToken ? "1" : "0");
  response.headers.set("x-mixtv-proxy-auth-secret", authCheck.hasSecret ? "set" : "unset");
  response.headers.set("x-mixtv-proxy-auth-cookies", listAuthCookieNames(request));

  return response;
}

async function checkAuthenticatedSession(request: ProxyRequest): Promise<AuthCheck> {
  if (request.auth?.user) {
    return {
      authenticated: true,
      hasPlainToken: false,
      hasRequestAuth: true,
      hasSecret: Boolean(process.env.AUTH_SECRET),
      hasSecureToken: false,
    };
  }

  const secret = readAuthSecret();
  const secureToken = await getToken({
    req: request,
    secret,
    secureCookie: true,
  });

  if (secureToken) {
    return {
      authenticated: true,
      hasPlainToken: false,
      hasRequestAuth: false,
      hasSecret: Boolean(process.env.AUTH_SECRET),
      hasSecureToken: true,
    };
  }

  const token = await getToken({
    req: request,
    secret,
    secureCookie: false,
  });

  return {
    authenticated: Boolean(token),
    hasPlainToken: Boolean(token),
    hasRequestAuth: false,
    hasSecret: Boolean(process.env.AUTH_SECRET),
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
