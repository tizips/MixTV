import { NextResponse } from "next/server";
import { ensureEdgeOneKvBindingsForNode } from "@/infrastructure/edgeone/node-kv-bindings";
import { z } from "zod";
import { authenticateLoginRequest, getAccountByJwt } from "@/modules/auth/server/login-api-service";
import { createAuthSessionCookie } from "@/modules/auth/server/session-cookie";
import { withApiTraffic } from "@/modules/stats";
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

export const POST = withApiTraffic(async function POST(request: Request) {
  ensureEdgeOneKvBindingsForNode();

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

    const account = await getAccountByJwt(result.jwt);

    if (!account) {
      return NextResponse.json({ message: "Invalid username or password." }, { status: 401 });
    }

    const response = NextResponse.json(result);
    const sessionCookie = await createAuthSessionCookie(request, {
      ...account,
      accessToken: result.jwt,
    });

    response.cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.options);

    return response;
  } catch {
    return NextResponse.json({ message: "Login service is not configured." }, { status: 500 });
  }
});
