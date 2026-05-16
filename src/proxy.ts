import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { auth } from "@/auth";
import { resolveSafeNextPath } from "@/modules/auth/server/redirect";

type ProxyRequest = Request & {
  auth?: {
    user?: unknown;
  } | null;
};

function readAuthSecret() {
  return process.env.AUTH_SECRET || "mixtv-development-auth-secret";
}

async function hasAuthenticatedSession(request: ProxyRequest) {
  if (request.auth?.user) {
    return true;
  }

  const secret = readAuthSecret();
  const secureToken = await getToken({
    req: request,
    secret,
    secureCookie: true,
  });

  if (secureToken) {
    return true;
  }

  const token = await getToken({
    req: request,
    secret,
    secureCookie: false,
  });

  return Boolean(token);
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
  const isAuthenticated = await hasAuthenticatedSession(request);

  if (pathname === "/login") {
    if (!isAuthenticated) {
      return NextResponse.next();
    }

    const redirectTo = resolveSafeNextPath(
      request.nextUrl.searchParams.get("next"),
    );

    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  if (isAuthenticated) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", nextPath);

  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
