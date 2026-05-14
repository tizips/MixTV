import { NextResponse } from "next/server";
import { saveConfigFilesSubscriptionAutoUpdate } from "@/modules/admin";
import {
  configSubscriptionAutoUpdateRequestSchema,
  getAdminConfigValidationMessage,
} from "@/modules/admin/server/admin-config-schemas";

export const runtime = "nodejs";

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

  const parsed = configSubscriptionAutoUpdateRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return badRequest(getAdminConfigValidationMessage(parsed.error));
  }

  try {
    return NextResponse.json(await saveConfigFilesSubscriptionAutoUpdate(parsed.data.autoUpdate));
  } catch (error) {
    console.error("Failed to update auto update config.", error);
    return NextResponse.json({ message: "Failed to update auto update config." }, { status: 500 });
  }
}
