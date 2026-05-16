import { NextResponse } from "next/server";
import { refreshCacheStats } from "@/modules/admin/server/cache-management-service";
import { withApiTraffic } from "@/modules/stats";

export const POST = withApiTraffic(async function POST() {
  try {
    return NextResponse.json(await refreshCacheStats());
  } catch (error) {
    console.error("Failed to refresh cache stats.", error);
    return NextResponse.json({ message: "Failed to refresh cache stats." }, { status: 500 });
  }
});
