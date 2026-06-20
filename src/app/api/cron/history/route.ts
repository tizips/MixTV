import { NextResponse } from "next/server";
import { checkAllHistoryUpdates } from "@/modules/history";
import { withApiTraffic } from "@/modules/stats";

export const runtime = "nodejs";

async function runScheduledHistoryUpdateCheck() {
  try {
    await checkAllHistoryUpdates();
  } catch (error) {
    console.error("Failed to run scheduled history update check.", error);
  }
}

function scheduleHistoryUpdateCheck() {
  setTimeout(() => {
    void runScheduledHistoryUpdateCheck();
  }, 0);
}

export const GET = withApiTraffic(async function GET() {
  scheduleHistoryUpdateCheck();
  return NextResponse.json({ message: "History update check scheduled." });
});
