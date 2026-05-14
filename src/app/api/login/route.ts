import { NextResponse } from "next/server";
import { authenticateLoginRequest } from "@/modules/auth/server/login-api-service";

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

  const username =
    typeof (payload as { username?: unknown })?.username === "string"
      ? (payload as { username: string }).username.trim()
      : "";
  const password =
    typeof (payload as { password?: unknown })?.password === "string"
      ? (payload as { password: string }).password
      : "";

  if (!username || !password) {
    return badRequest("username and password are required.");
  }

  try {
    const result = await authenticateLoginRequest({ password, username });

    if (!result) {
      return NextResponse.json({ message: "Invalid username or password." }, { status: 401 });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ message: "Login service is not configured." }, { status: 500 });
  }
}
