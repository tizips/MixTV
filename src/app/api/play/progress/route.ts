import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  savePlaybackProgress,
  PlaybackProgressValidationError,
} from "@/modules/playback/server/playback-progress-service";
import { withApiTraffic } from "@/modules/stats";

export const runtime = "nodejs";

function readUserId(session: unknown) {
  if (!session || typeof session !== "object") {
    return "";
  }

  const user = (session as { user?: unknown }).user;
  if (!user || typeof user !== "object") {
    return "";
  }

  const id = (user as { id?: unknown }).id;

  return typeof id === "string" ? id : "";
}

async function readJson(request: Request) {
  try {
    return await request.json() as unknown;
  } catch {
    throw new PlaybackProgressValidationError("Request body must be valid JSON.");
  }
}

function asObject(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new PlaybackProgressValidationError("Request body must be an object.");
  }

  return input as Record<string, unknown>;
}

export const POST = withApiTraffic(async function POST(request: Request) {
  const userId = readUserId(await auth());

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const payload = asObject(await readJson(request));
    const progress = await savePlaybackProgress(
      {
        id: payload.id as string,
        play_episodes: payload.play_episodes as number,
        play_time: payload.play_time as number,
        source: payload.source as string,
        total_time: payload.total_time as number,
      },
      { userId },
    );

    return NextResponse.json({ progress }, { status: 201 });
  } catch (error) {
    if (error instanceof PlaybackProgressValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: "Failed to update playback progress." }, { status: 500 });
  }
});
