import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateLoginRequest } from "@/modules/auth/server/login-api-service";
import { usernamePattern, userPasswordPattern } from "@/shared/user-credentials";

export const runtime = "nodejs";

const loginRequestSchema = z
  .object({
    password: z.string().regex(userPasswordPattern),
    username: z.string().trim().regex(usernamePattern),
  })
  .strict();

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

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return badRequest("Request body must be an object.");
  }

  const parsedPayload = loginRequestSchema.safeParse(payload);

  if (!parsedPayload.success) {
    const hasUnsupportedFields = parsedPayload.error.issues.some(
      (issue) => issue.code === "unrecognized_keys",
    );

    if (hasUnsupportedFields) {
      return badRequest("Request body contains unsupported fields.");
    }

    return badRequest("Invalid username or password.");
  }

  try {
    const result = await authenticateLoginRequest(parsedPayload.data);

    if (!result) {
      return NextResponse.json({ message: "Invalid username or password." }, { status: 401 });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ message: "Login service is not configured." }, { status: 500 });
  }
}
