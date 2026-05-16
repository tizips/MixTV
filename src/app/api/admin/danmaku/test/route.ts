import { NextResponse } from "next/server";
import { testDanmakuConnection } from "@/modules/admin/server/danmaku-service";
import {
  danmakuTestRequestSchema,
  getAdminConfigValidationMessage,
} from "@/modules/admin/server/admin-config-schemas";
import { withApiTraffic } from "@/modules/stats";

export const POST = withApiTraffic(async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = danmakuTestRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ message: getAdminConfigValidationMessage(parsed.error) }, { status: 400 });
  }

  try {
    return NextResponse.json(await testDanmakuConnection(parsed.data));
  } catch {
    return NextResponse.json({ message: "Failed to test danmaku connection." }, { status: 500 });
  }
});
