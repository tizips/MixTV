import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveSafeNextPath } from "@/modules/auth/server/redirect";

export default auth((request) => {
  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith("/api");
  const isPublicApiRoute =
    pathname === "/api/login" || pathname.startsWith("/api/auth/");

  if (isApiRoute) {
    if (isPublicApiRoute || request.auth?.user) {
      return NextResponse.next();
    }

    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const nextPath = resolveSafeNextPath(
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  if (pathname === "/login") {
    if (!request.auth?.user) {
      return NextResponse.next();
    }

    const redirectTo = resolveSafeNextPath(
      request.nextUrl.searchParams.get("next"),
    );

    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  if (request.auth?.user) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", nextPath);

  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
