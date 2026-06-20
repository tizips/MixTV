import { NextResponse } from "next/server";
import { checkAllHistoryUpdates } from "@/modules/history";
import { withApiTraffic } from "@/modules/stats";

export const runtime = "nodejs";
export const maxDuration = 120;

async function runScheduledHistoryUpdateCheck() {
  return checkAllHistoryUpdates();
}

export const GET = withApiTraffic(async function GET() {
  try {
    const result = await runScheduledHistoryUpdateCheck();
    return NextResponse.json({ message: "History update check completed.", result });
  } catch (error) {
    console.error("Failed to run scheduled history update check.", error);
    return NextResponse.json({ message: "Failed to run scheduled history update check." }, { status: 500 });
  }
});
