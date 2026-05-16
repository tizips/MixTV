import { NextResponse } from "next/server";
import { getPerformanceMetrics } from "@/modules/admin/server/performance-service";
import { withApiTraffic } from "@/modules/stats";

export const GET = withApiTraffic(async function GET() {
  return NextResponse.json(await getPerformanceMetrics());
});
