import { handlers } from "@/auth";
import { ensureEdgeOneKvBindingsForNode } from "@/infrastructure/edgeone/node-kv-bindings";

export const runtime = "nodejs";

ensureEdgeOneKvBindingsForNode();

export const { GET, POST } = handlers;
