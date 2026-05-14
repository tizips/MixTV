import { NextResponse } from "next/server";
import {
  AdminModuleValidationError,
  testCloudSearchConnection,
} from "@/modules/admin/server/admin-modules-service";

export const runtime = "edge";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    return NextResponse.json(await testCloudSearchConnection(payload));
  } catch (error) {
    if (error instanceof AdminModuleValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json({ message: "Failed to test cloud search connection." }, { status: 500 });
  }
}
