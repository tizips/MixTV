import { NextResponse } from "next/server";
import {
  getAdminConfigValidationMessage,
  timingManagementConfigRequestSchema,
} from "@/modules/admin/server/admin-config-schemas";
import {
  getTimingManagementConfig,
  saveTimingManagementConfig,
} from "@/modules/admin/server/timing-management-service";
import { withApiTraffic } from "@/modules/stats";

function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}

export const GET = withApiTraffic(async function GET() {
  try {
    return NextResponse.json(await getTimingManagementConfig());
  } catch (error) {
    console.error("Failed to load timing management config.", error);
    return NextResponse.json({ message: "Failed to load timing management config." }, { status: 500 });
  }
});

export const POST = withApiTraffic(async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  const parsed = timingManagementConfigRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return badRequest(getAdminConfigValidationMessage(parsed.error));
  }

  try {
    return NextResponse.json(await saveTimingManagementConfig(parsed.data));
  } catch (error) {
    console.error("Failed to save timing management config.", error);
    return NextResponse.json({ message: "Failed to save timing management config." }, { status: 500 });
  }
});
