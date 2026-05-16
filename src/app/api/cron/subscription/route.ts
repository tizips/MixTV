import { after, NextResponse } from "next/server";
import { runConfigFilesSubscriptionAutoUpdate } from "@/modules/admin";
import { withApiTraffic } from "@/modules/stats";

export const runtime = "nodejs";

export const GET = withApiTraffic(async function GET() {
  after(async () => {
    try {
      await runConfigFilesSubscriptionAutoUpdate();
    } catch (error) {
      console.error("Failed to run scheduled subscription update.", error);
    }
  });

  return NextResponse.json({ message: "Subscription update scheduled." });
});
