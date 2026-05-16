import { NextResponse } from "next/server";
import {
  getCloudSearchConfig,
  saveCloudSearchConfig,
} from "@/modules/admin/server/cloud-search-service";
import { cloudSearchConfigRequestSchema, getAdminConfigValidationMessage } from "@/modules/admin/server/admin-config-schemas";
import { withApiTraffic } from "@/modules/stats";

function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}

export const GET = withApiTraffic(async function GET() {
  try {
    return NextResponse.json(await getCloudSearchConfig());
  } catch (error) {
    console.error("Failed to load cloud search config.", error);
    return NextResponse.json({ message: "Failed to load cloud search config." }, { status: 500 });
  }
});

export const POST = withApiTraffic(async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  const parsed = cloudSearchConfigRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return badRequest(getAdminConfigValidationMessage(parsed.error));
  }

  try {
    return NextResponse.json(await saveCloudSearchConfig(parsed.data));
  } catch (error) {
    console.error("Failed to save cloud search config.", error);
    return NextResponse.json({ message: "Failed to save cloud search config." }, { status: 500 });
  }
});
