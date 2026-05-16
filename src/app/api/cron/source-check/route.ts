import { after, NextResponse } from "next/server";
import { checkVideoSourceValidities } from "@/modules/admin/server/video-source-service";
import { env } from "@/shared/env";
import { withApiTraffic } from "@/modules/stats";

const defaultValidityKeyword = "斗罗大陆";

export const runtime = "nodejs";

export const GET = withApiTraffic(async function GET() {
  after(async () => {
    try {
      await checkVideoSourceValidities(
        { keyword: defaultValidityKeyword },
        {
          removeInvalidSources: env.VIDEO_SOURCE_DELETE_INVALID_ON_CHECK,
        },
      );
    } catch (error) {
      console.error("Failed to run scheduled video source validity check.", error);
    }
  });

  return NextResponse.json({ message: "Video source validity check scheduled." });
});
