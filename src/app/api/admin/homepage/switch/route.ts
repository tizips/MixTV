import { NextResponse } from "next/server";
import {
  getAdminConfigValidationMessage,
  homepageConfigSwitchRequestSchema,
} from "@/modules/admin/server/admin-config-schemas";
import { saveHomepageConfigSwitch } from "@/modules/admin/server/homepage-modules-service";
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

  const parsed = homepageConfigSwitchRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return badRequest(getAdminConfigValidationMessage(parsed.error));
  }

  try {
    return NextResponse.json(await saveHomepageConfigSwitch(parsed.data.key, parsed.data.value));
  } catch (error) {
    console.error("Failed to update homepage config switch.", error);
    return NextResponse.json({ message: "Failed to update homepage config switch." }, { status: 500 });
  }
});
