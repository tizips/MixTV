import { NextResponse } from "next/server";
import { getConfigFilesContent, saveConfigFilesContent } from "@/modules/admin";
import {
  configContentRequestSchema,
  getAdminConfigValidationMessage,
} from "@/modules/admin/server/admin-config-schemas";

export const runtime = "nodejs";

function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}

export async function GET() {
  try {
    return NextResponse.json(await getConfigFilesContent());
  } catch (error) {
    console.error("Failed to load config content.", error);
    return NextResponse.json({ message: "Failed to load config content." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  const parsed = configContentRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return badRequest(getAdminConfigValidationMessage(parsed.error));
  }

  try {
    return NextResponse.json(await saveConfigFilesContent(parsed.data.content));
  } catch (error) {
    console.error("Failed to save config content.", error);
    return NextResponse.json({ message: "Failed to save config content." }, { status: 500 });
  }
}
