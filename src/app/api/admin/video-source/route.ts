import { NextResponse } from "next/server";
import { AdminModuleValidationError, createVideoSource } from "@/modules/admin/server/video-source-service";
import { withApiTraffic } from "@/modules/stats";

function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}

export const POST = withApiTraffic(async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  try {
    return NextResponse.json(await createVideoSource(payload), { status: 201 });
  } catch (error) {
    if (error instanceof AdminModuleValidationError) {
      return badRequest(error.message);
    }
    console.error("Failed to create video source.", error);
    return NextResponse.json({ message: "Failed to create video source." }, { status: 500 });
  }
});
