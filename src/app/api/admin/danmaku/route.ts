import { NextResponse } from "next/server";
import {
  getDanmakuConfig,
  saveDanmakuConfig,
} from "@/modules/admin/server/danmaku-service";
import {
  danmakuConfigRequestSchema,
  getAdminConfigValidationMessage,
} from "@/modules/admin/server/admin-config-schemas";

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

  const parsed = danmakuConfigRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return badRequest(getAdminConfigValidationMessage(parsed.error));
  }

  try {
    return NextResponse.json(await saveDanmakuConfig(parsed.data));
  } catch (error) {
    console.error("Failed to save danmaku config.", error);
    return NextResponse.json({ message: "Failed to save danmaku config." }, { status: 500 });
  }
}
