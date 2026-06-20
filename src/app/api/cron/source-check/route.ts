import { NextResponse } from "next/server";
import { checkVideoSourceValidities } from "@/modules/admin/server/video-source-service";
import { env } from "@/shared/env";
import { withApiTraffic } from "@/modules/stats";

const defaultValidityKeyword = "斗罗大陆";
const scheduledValidityCheckConcurrency = 10;

export const runtime = "nodejs";
export const maxDuration = 120;

function readValidityKeyword(request: Request) {
  return new URL(request.url).searchParams.get("keyword")?.trim() || defaultValidityKeyword;
}

async function runScheduledVideoSourceValidityCheck(keyword: string) {
  return checkVideoSourceValidities(
    { keyword },
    {
      concurrency: scheduledValidityCheckConcurrency,
      removeInvalidSources: env.VIDEO_SOURCE_DELETE_INVALID_ON_CHECK,
    },
  );
}

export const GET = withApiTraffic(async function GET(request: Request) {
  try {
    const result = await runScheduledVideoSourceValidityCheck(readValidityKeyword(request));
    return NextResponse.json({ message: "Video source validity check completed.", result });
  } catch (error) {
    console.error("Failed to run scheduled video source validity check.", error);
    return NextResponse.json({ message: "Failed to run scheduled video source validity check." }, { status: 500 });
  }
});
