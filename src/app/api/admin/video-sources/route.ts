import { NextResponse } from "next/server";
import { getVideoSources } from "@/modules/admin/server/video-source-service";

export async function GET() {
  try {
    return NextResponse.json(await getVideoSources());
  } catch (error) {
    console.error("Failed to load video sources.", error);
    return NextResponse.json({ message: "Failed to load video sources." }, { status: 500 });
  }
}
