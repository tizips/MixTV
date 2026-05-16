import { after, NextResponse } from "next/server";
import { checkAllHistoryUpdates } from "@/modules/history";
import { withApiTraffic } from "@/modules/stats";

export const runtime = "nodejs";

export const GET = withApiTraffic(async function GET() {
  after(async () => {
    try {
      await checkAllHistoryUpdates();
    } catch (error) {
      console.error("Failed to run scheduled history update check.", error);
    }
  });

  return NextResponse.json({ message: "History update check scheduled." });
});
