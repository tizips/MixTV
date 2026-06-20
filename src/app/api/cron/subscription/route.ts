import { NextResponse } from "next/server";
import { runConfigFilesSubscriptionAutoUpdate } from "@/modules/admin";
import { withApiTraffic } from "@/modules/stats";

export const runtime = "nodejs";

async function runScheduledSubscriptionUpdate() {
  try {
    await runConfigFilesSubscriptionAutoUpdate();
  } catch (error) {
    console.error("Failed to run scheduled subscription update.", error);
  }
}

function scheduleSubscriptionUpdate() {
  setTimeout(() => {
    void runScheduledSubscriptionUpdate();
  }, 0);
}

export const GET = withApiTraffic(async function GET() {
  scheduleSubscriptionUpdate();
  return NextResponse.json({ message: "Subscription update scheduled." });
});
