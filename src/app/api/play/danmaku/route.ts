import { NextResponse } from "next/server";
import {
  createPlaybackDanmakuApiResponse,
  getPlaybackDanmaku,
} from "@/modules/playback/server/playback-danmaku-service";
import { withApiTraffic } from "@/modules/stats";

export const GET = withApiTraffic(async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  try {
    const danmaku = await getPlaybackDanmaku({
      title: searchParams.get("title") ?? "",
      play_episodes: searchParams.get("play_episodes") ?? "",
    });

    return createPlaybackDanmakuApiResponse(danmaku);
  } catch (error) {
    console.error("Failed to load playback danmaku.", error);
    return NextResponse.json({ message: "Failed to load playback danmaku." }, { status: 500 });
  }
});
