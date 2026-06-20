import { NextResponse } from "next/server";
import { checkVideoSourceValidities } from "@/modules/admin/server/video-source-service";
import { env } from "@/shared/env";
import { withApiTraffic } from "@/modules/stats";

const defaultValidityKeyword = "斗罗大陆";

export const runtime = "nodejs";

function readValidityKeyword(request: Request) {
  return new URL(request.url).searchParams.get("keyword")?.trim() || defaultValidityKeyword;
}

async function runScheduledVideoSourceValidityCheck(keyword: string) {
  try {
    await checkVideoSourceValidities(
      { keyword },
      {
        removeInvalidSources: env.VIDEO_SOURCE_DELETE_INVALID_ON_CHECK,
      },
    );
  } catch (error) {
    console.error("Failed to run scheduled video source validity check.", error);
  }
}

function scheduleVideoSourceValidityCheck(keyword: string) {
  setTimeout(() => {
    void runScheduledVideoSourceValidityCheck(keyword);
  }, 0);
}

export const GET = withApiTraffic(async function GET(request: Request) {
  scheduleVideoSourceValidityCheck(readValidityKeyword(request));
  return NextResponse.json({ message: "Video source validity check scheduled." });
});
