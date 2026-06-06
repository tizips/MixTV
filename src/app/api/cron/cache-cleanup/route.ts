import { after, NextResponse } from "next/server";
import { cleanupExpiredCacheKvEntries } from "@/modules/admin/server/cache-management-service";
import { withApiTraffic } from "@/modules/stats";

export const runtime = "nodejs";

export const GET = withApiTraffic(async function GET() {
  after(async () => {
    try {
      await cleanupExpiredCacheKvEntries();
    } catch (error) {
      console.error("Failed to run scheduled cache cleanup.", error);
    }
  });

  return NextResponse.json({ message: "Cache cleanup scheduled." });
});
