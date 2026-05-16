import { NextResponse } from "next/server";
import { saveConfigFilesSubscriptionPull } from "@/modules/admin";
import {
  configSubscriptionPullRequestSchema,
  getAdminConfigValidationMessage,
} from "@/modules/admin/server/admin-config-schemas";
import { withApiTraffic } from "@/modules/stats";

export const runtime = "nodejs";

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

  const parsed = configSubscriptionPullRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return badRequest(getAdminConfigValidationMessage(parsed.error));
  }

  try {
    return NextResponse.json(await saveConfigFilesSubscriptionPull(parsed.data.url));
  } catch (error) {
    console.error("Failed to pull subscription config.", error);
    return NextResponse.json({ message: "Failed to pull subscription config." }, { status: 500 });
  }
});
