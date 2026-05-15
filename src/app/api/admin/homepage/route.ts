import { NextResponse } from "next/server";
import { AdminModuleValidationError } from "@/modules/admin/server/admin-module-error";
import {
  getHomepageConfig,
  saveHomepageConfig,
} from "@/modules/admin/server/homepage-modules-service";

function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}

export async function GET() {
  try {
    return NextResponse.json(await getHomepageConfig());
  } catch (error) {
    console.error("Failed to load homepage config.", error);
    return NextResponse.json({ message: "Failed to load homepage config." }, { status: 500 });
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
    return NextResponse.json(await saveHomepageConfig(payload));
  } catch (error) {
    if (error instanceof AdminModuleValidationError) {
      return badRequest(error.message);
    }
    console.error("Failed to save homepage config.", error);
    return NextResponse.json({ message: "Failed to save homepage config." }, { status: 500 });
  }
}
