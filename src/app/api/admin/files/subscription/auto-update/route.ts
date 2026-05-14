import { NextResponse } from "next/server";
import { saveConfigFilesSubscriptionAutoUpdate } from "@/modules/admin";

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

  const autoUpdate =
    typeof (payload as { autoUpdate?: unknown })?.autoUpdate === "boolean"
      ? (payload as { autoUpdate: boolean }).autoUpdate
      : null;

  if (autoUpdate === null) {
    return badRequest("autoUpdate is required.");
  }

  try {
    return NextResponse.json(await saveConfigFilesSubscriptionAutoUpdate(autoUpdate));
  } catch (error) {
    console.error("Failed to update auto update config.", error);
    return NextResponse.json({ message: "Failed to update auto update config." }, { status: 500 });
  }
}
