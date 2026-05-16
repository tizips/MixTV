import { NextResponse } from "next/server";
import { getCacheData } from "@/modules/admin/server/cache-management-service";
import { withApiTraffic } from "@/modules/stats";

export const GET = withApiTraffic(async function GET() {
  try {
    return NextResponse.json(await getCacheData());
  } catch (error) {
    console.error("Failed to load cache data.", error);
    return NextResponse.json({ message: "Failed to load cache data." }, { status: 500 });
  }
});
