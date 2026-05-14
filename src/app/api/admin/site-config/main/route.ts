import { NextResponse } from "next/server";
import {
  getAdminConfigValidationMessage,
  siteConfigMainRequestSchema,
} from "@/modules/admin/server/admin-config-schemas";
import {
  saveSiteConfigLeft,
  SiteConfigValidationError,
} from "@/modules/admin/server/site-config-service";

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

  const parsed = siteConfigMainRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return badRequest(getAdminConfigValidationMessage(parsed.error));
  }

  try {
    return NextResponse.json(await saveSiteConfigLeft(parsed.data));
  } catch (error) {
    if (error instanceof SiteConfigValidationError) {
      return badRequest(error.message);
    }

    console.error("Failed to update site config.", error);
    return NextResponse.json({ message: "Failed to update site config." }, { status: 500 });
  }
}
