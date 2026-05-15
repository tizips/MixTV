import { NextResponse } from "next/server";
import { getPerformanceMetrics } from "@/modules/admin/server/performance-service";

export async function GET() {
  return NextResponse.json(await getPerformanceMetrics());
}
