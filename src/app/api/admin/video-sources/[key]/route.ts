import { NextResponse } from "next/server";
import {
  AdminModuleValidationError,
  deleteVideoSource,
  updateVideoSource,
} from "@/modules/admin/server/video-source-service";

type RouteContext = {
  params: Promise<{ key: string }>;
};

function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}

export async function PUT(request: Request, context: RouteContext) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  try {
    const { key } = await context.params;
    return NextResponse.json(await updateVideoSource(key, payload));
  } catch (error) {
    if (error instanceof AdminModuleValidationError) {
      return badRequest(error.message);
    }
    console.error("Failed to update video source.", error);
    return NextResponse.json({ message: "Failed to update video source." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { key } = await context.params;
    return NextResponse.json(await deleteVideoSource(key));
  } catch (error) {
    if (error instanceof AdminModuleValidationError) {
      return badRequest(error.message);
    }
    console.error("Failed to delete video source.", error);
    return NextResponse.json({ message: "Failed to delete video source." }, { status: 500 });
  }
}
