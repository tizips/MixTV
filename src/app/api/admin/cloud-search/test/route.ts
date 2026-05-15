import { NextResponse } from "next/server";
import {
  testCloudSearchConnection,
} from "@/modules/admin/server/cloud-search-service";
import { cloudSearchTestRequestSchema, getAdminConfigValidationMessage } from "@/modules/admin/server/admin-config-schemas";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = cloudSearchTestRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ message: getAdminConfigValidationMessage(parsed.error) }, { status: 400 });
  }

  try {
    return NextResponse.json(await testCloudSearchConnection(parsed.data));
  } catch {
    return NextResponse.json({ message: "Failed to test cloud search connection." }, { status: 500 });
  }
}
