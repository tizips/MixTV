import { NextResponse } from "next/server";
import {
  AdminModuleValidationError,
  getDanmakuConfig,
  saveDanmakuConfig,
} from "@/modules/admin/server/admin-modules-service";

export const runtime = "edge";

function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}

export async function GET() {
  try {
    return NextResponse.json(await getDanmakuConfig());
  } catch (error) {
    console.error("Failed to load danmaku config.", error);
    return NextResponse.json({ message: "Failed to load danmaku config." }, { status: 500 });
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
    return NextResponse.json(await saveDanmakuConfig(payload));
  } catch (error) {
    if (error instanceof AdminModuleValidationError) {
      return badRequest(error.message);
    }
    console.error("Failed to save danmaku config.", error);
    return NextResponse.json({ message: "Failed to save danmaku config." }, { status: 500 });
  }
}
