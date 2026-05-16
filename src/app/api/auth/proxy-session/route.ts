import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return new NextResponse(null, { status: 401 });
  }

  return new NextResponse(null, { status: 204 });
}
