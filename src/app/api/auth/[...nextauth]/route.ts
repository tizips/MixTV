import { handlers } from "@/auth";
import { ensureEdgeOneKvBindingsForNode } from "@/infrastructure/edgeone/node-kv-bindings";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

ensureEdgeOneKvBindingsForNode();

export const { GET } = handlers;

function isCredentialsCallback(request: Request) {
  return new URL(request.url).pathname.endsWith("/api/auth/callback/credentials");
}

function credentialsCallbackError(request: Request) {
  const requestUrl = new URL(request.url);
  const loginUrl = new URL("/login", requestUrl.origin);

  loginUrl.searchParams.set("error", "CredentialsSignin");
  loginUrl.searchParams.set("code", "credentials");

  return NextResponse.json({ url: loginUrl.toString() }, { status: 400 });
}

export function POST(request: NextRequest) {
  if (isCredentialsCallback(request)) {
    return credentialsCallbackError(request);
  }

  return handlers.POST(request);
}
