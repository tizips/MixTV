import { NextResponse } from "next/server";
import { getConfigFilesContent, saveConfigFilesContent } from "@/modules/admin";

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

  const content =
    typeof (payload as { content?: unknown })?.content === "string" ? (payload as { content: string }).content : null;

  if (content === null) {
    return badRequest("content is required.");
  }

  try {
    return NextResponse.json(await saveConfigFilesContent(content));
  } catch (error) {
    console.error("Failed to save config content.", error);
    return NextResponse.json({ message: "Failed to save config content." }, { status: 500 });
  }
}
