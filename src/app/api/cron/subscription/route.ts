import { NextResponse } from "next/server";
import { runConfigFilesSubscriptionAutoUpdate } from "@/modules/admin";
import { withApiTraffic } from "@/modules/stats";

export const runtime = "nodejs";
export const maxDuration = 120;

async function runScheduledSubscriptionUpdate() {
  return runConfigFilesSubscriptionAutoUpdate();
}

export const GET = withApiTraffic(async function GET() {
  try {
    const result = await runScheduledSubscriptionUpdate();
    return NextResponse.json({ message: "Subscription update completed.", result });
  } catch (error) {
    console.error("Failed to run scheduled subscription update.", error);
    return NextResponse.json({ message: "Failed to run scheduled subscription update." }, { status: 500 });
  }
});
