import { NextResponse } from "next/server";
import {
  AdminModuleValidationError,
  getTimingManagementConfig,
  saveTimingManagementConfig,
} from "@/modules/admin/server/admin-modules-service";

export const runtime = "edge";

function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}

export async function GET() {
  try {
    return NextResponse.json(await getTimingManagementConfig());
  } catch (error) {
    console.error("Failed to load timing management config.", error);
    return NextResponse.json({ message: "Failed to load timing management config." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  try {
    return NextResponse.json(await saveTimingManagementConfig(payload));
  } catch (error) {
    if (error instanceof AdminModuleValidationError) {
      return badRequest(error.message);
    }
    console.error("Failed to save timing management config.", error);
    return NextResponse.json({ message: "Failed to save timing management config." }, { status: 500 });
  }
}
