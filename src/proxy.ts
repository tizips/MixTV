import { NextResponse } from "next/server";
// import { getToken } from "next-auth/jwt";
// import { resolveSafeNextPath } from "@/modules/auth/server/redirect";

// type AuthCheck = {
//   hasApiSession: boolean;
//   authenticated: boolean;
//   hasPlainToken: boolean;
//   hasRequestAuth: boolean;
//   hasSecureToken: boolean;
//   hasSecret: boolean;
// };

// function readAuthSecret() {
//   return process.env.AUTH_SECRET;
// }

// async function checkAuthenticatedSession(
//   request: NextRequest,
// ): Promise<AuthCheck> {
//   const requestAuth = (
//     request as NextRequest & { auth?: { user?: unknown } | null }
//   ).auth;

//   if (requestAuth?.user) {
//     return {
//       hasApiSession: false,
//       authenticated: true,
//       hasPlainToken: false,
//       hasRequestAuth: true,
//       hasSecret: Boolean(readAuthSecret()),
//       hasSecureToken: false,
//     };
//   }

//   const secret = readAuthSecret();

//   if (!secret) {
//     const sessionResponse = await fetch(
//       new URL("/api/auth/proxy-session", request.nextUrl.origin).toString(),
//       {
//         cache: "no-store",
//         headers: {
//           cookie: request.headers.get("cookie") ?? "",
//         },
//       },
//     );

//     return {
//       hasApiSession: sessionResponse.ok,
//       authenticated: sessionResponse.ok,
//       hasPlainToken: false,
//       hasRequestAuth: false,
//       hasSecret: false,
//       hasSecureToken: false,
//     };
//   }

//   const secureToken = await getToken({
//     req: request,
//     secret,
//     secureCookie: true,
//   });

//   if (secureToken) {
//     return {
//       hasApiSession: false,
//       authenticated: true,
//       hasPlainToken: false,
//       hasRequestAuth: false,
//       hasSecret: true,
//       hasSecureToken: true,
//     };
//   }

//   const token = await getToken({
//     req: request,
//     secret,
//     secureCookie: false,
//   });

//   return {
//     hasApiSession: false,
//     authenticated: Boolean(token),
//     hasPlainToken: Boolean(token),
//     hasRequestAuth: false,
//     hasSecret: true,
//     hasSecureToken: false,
//   };
// }

export function proxy() {
  // Auth enforcement has moved to the layout-level AccountGate.
  // const pathname = request.nextUrl.pathname;
  // const isApiRoute = pathname.startsWith("/api");

  // if (isApiRoute) {
  //   return NextResponse.next();
  // }

  // const nextPath = resolveSafeNextPath(
  //   `${request.nextUrl.pathname}${request.nextUrl.search}`,
  // );
  // const authCheck = await checkAuthenticatedSession(request);
  // const isAuthenticated = authCheck.authenticated;

  // if (pathname === "/login") {
  //   if (!isAuthenticated) {
  //     return authResponse(NextResponse.next(), request, authCheck);
  //   }

  //   const redirectTo = resolveSafeNextPath(request.nextUrl.searchParams.get("next"));

  //   return authResponse(
  //     NextResponse.redirect(new URL(redirectTo, request.url)),
  //     request,
  //     authCheck,
  //   );
  // }

  // if (isAuthenticated) {
  //   return authResponse(NextResponse.next(), request, authCheck);
  // }

  // const loginUrl = new URL("/login", request.url);
  // loginUrl.searchParams.set("next", nextPath);

  // return NextResponse.redirect(loginUrl);

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api(?:/|$)|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
