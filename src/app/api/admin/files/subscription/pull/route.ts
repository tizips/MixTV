import { NextResponse } from "next/server";
import { saveConfigFilesSubscriptionPull } from "@/modules/admin";

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

  const url = typeof (payload as { url?: unknown })?.url === "string" ? (payload as { url: string }).url : "";

  if (!url.trim()) {
    return badRequest("url is required.");
  }

  try {
    return NextResponse.json(await saveConfigFilesSubscriptionPull(url));
  } catch (error) {
    console.error("Failed to pull subscription config.", error);
    return NextResponse.json({ message: "Failed to pull subscription config." }, { status: 500 });
  }
}
