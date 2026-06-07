import { NextResponse } from "next/server";
import { createExpiredAuthSessionCookies } from "@/modules/auth/server/session-cookie";
import { withApiTraffic } from "@/modules/stats";

export const runtime = "nodejs";

export const POST = withApiTraffic(async function POST() {
  const response = new NextResponse(null, { status: 204 });

  for (const cookie of createExpiredAuthSessionCookies()) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }

  response.headers.set("Cache-Control", "no-store");

  return response;
});
