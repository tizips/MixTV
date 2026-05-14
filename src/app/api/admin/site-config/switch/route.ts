import { NextResponse } from "next/server";
import {
  getAdminConfigValidationMessage,
  siteConfigSwitchRequestSchema,
} from "@/modules/admin/server/admin-config-schemas";
import { saveSiteConfigSwitch } from "@/modules/admin/server/site-config-service";

function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  const parsed = siteConfigSwitchRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return badRequest(getAdminConfigValidationMessage(parsed.error));
  }

  try {
    return NextResponse.json(await saveSiteConfigSwitch(parsed.data.key, parsed.data.value));
  } catch (error) {
    console.error("Failed to update site config switch.", error);
    return NextResponse.json({ message: "Failed to update site config switch." }, { status: 500 });
  }
}
