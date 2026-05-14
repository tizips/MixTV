import { NextResponse } from "next/server";
import { AdminModuleValidationError, batchUpdateVideoSources } from "@/modules/admin/server/video-source-service";

export async function PUT(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    return NextResponse.json(await batchUpdateVideoSources(payload));
  } catch (error) {
    if (error instanceof AdminModuleValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    console.error("Failed to batch update video sources.", error);
    return NextResponse.json({ message: "Failed to batch update video sources." }, { status: 500 });
  }
}
