import { NextResponse } from "next/server";
import { getAccountByJwt } from "@/modules/auth/server/login-api-service";
import { withApiTraffic } from "@/modules/stats";

export const runtime = "nodejs";

function readBearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";

  if (!authorization.startsWith("Bearer ")) {
    return "";
  }

  return authorization.slice("Bearer ".length).trim();
}

export const GET = withApiTraffic(async function GET(request: Request) {
  const jwt = readBearerToken(request);

  if (!jwt) {
    return NextResponse.json({ message: "Authorization bearer token is required." }, { status: 401 });
  }

  try {
    const account = await getAccountByJwt(jwt);

    if (!account) {
      return NextResponse.json({ message: "Invalid or expired token." }, { status: 401 });
    }

    return NextResponse.json(account);
  } catch {
    return NextResponse.json({ message: "Account service is not configured." }, { status: 500 });
  }
});
