import { NextResponse } from "next/server";
import { ensureEdgeOneKvBindingsForNode } from "@/infrastructure/edgeone/node-kv-bindings";
import { z } from "zod";
import { authenticateLoginRequest, getAccountByJwt } from "@/modules/auth/server/login-api-service";
import { createAuthSessionCookie } from "@/modules/auth/server/session-cookie";

export const runtime = "nodejs";

const loginRequestSchema = z
  .object({
    password: z.string().min(1),
    username: z.string().trim().min(1),
  })
  .strict();

function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}

function getRequestContentType(request: Request) {
  return request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
}

function readFormPayload(body: string) {
  const params = new URLSearchParams(body);

  if (!params.has("username") && !params.has("password")) {
    return null;
  }

  return Object.fromEntries(params);
}

function readFormDataPayload(formData: FormData) {
  const payload: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      payload[key] = value;
    }
  }

  return payload;
}

async function readLoginRequestPayload(request: Request) {
  const contentType = getRequestContentType(request);

  if (contentType === "multipart/form-data") {
    return readFormDataPayload(await request.formData());
  }

  const body = await request.text();

  if (contentType === "application/x-www-form-urlencoded") {
    return readFormPayload(body) ?? {};
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    const formPayload = readFormPayload(body);

    if (formPayload) {
      return formPayload;
    }

    throw error;
  }
}

export async function POST(request: Request) {
  ensureEdgeOneKvBindingsForNode();

  let payload: unknown;

  try {
    payload = await readLoginRequestPayload(request);
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
}
