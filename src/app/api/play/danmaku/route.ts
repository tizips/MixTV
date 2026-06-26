import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createPlaybackDanmakuApiResponse,
  createPlaybackDanmakuSegmentApiResponse,
  getPlaybackDanmaku,
  getPlaybackDanmakuSegment,
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

const segmentRequestSchema = z.object({
  segment: z.object({
    start: z.number({ error: "segment.start is required." }),
    end: z.number({ error: "segment.end is required." }),
    url: z
      .string({ error: "segment.url is required." })
      .trim()
      .min(1, "segment.url is required.")
      .refine((value) => {
        try {
          const parsed = new URL(value);
          return parsed.protocol === "http:" || parsed.protocol === "https:";
        } catch {
          return false;
        }
      }, "segment.url must be a valid http(s) URL."),
    type: z
      .string({ error: "segment.type is required." })
      .trim()
      .min(1, "segment.type is required."),
    data: z.string().optional(),
    mH5Tk: z.string().optional(),
    mH5TkEnc: z.string().optional(),
  }),
});

export const POST = withApiTraffic(async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = segmentRequestSchema.safeParse(payload);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ message: issue?.message ?? "Invalid segment request." }, { status: 400 });
  }

  try {
    const items = await getPlaybackDanmakuSegment({ segment: parsed.data.segment });

    return createPlaybackDanmakuSegmentApiResponse(items);
  } catch (error) {
    console.error("Failed to load playback danmaku segment.", error);
    return NextResponse.json({ message: "Failed to load playback danmaku segment." }, { status: 500 });
  }
});
