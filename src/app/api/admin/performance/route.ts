import { NextResponse } from "next/server";
import { getPerformanceMetrics } from "@/modules/admin/server/admin-modules-service";

export const runtime = "edge";

export async function GET() {
  return NextResponse.json(await getPerformanceMetrics());
}
