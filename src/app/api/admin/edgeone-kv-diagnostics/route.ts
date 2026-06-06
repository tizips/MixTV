import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createEdgeOneKvDbAdapter, type EdgeOneKvBinding } from "@/infrastructure/db/edgeone-kv-db-adapter";
import { getAccountByJwt } from "@/modules/auth/server/login-api-service";

export const runtime = "edge";

type KeyStatus = "error" | "set" | "unset";

const defaultEnvBindingName = "env";
const defaultStoreBindingNames = {
  cache: "cache",
  cfg: "cfg",
  user: "user",
};

const runtimeEnvNames = [
  "AUTH_SECRET",
  "CRON_BASE_URL",
  "PASSWORD",
  "USERNAME",
];

function isEdgeOneKvBinding(value: unknown): value is EdgeOneKvBinding {
  if (!value || typeof value !== "object") {
    return false;
  }

  const binding = value as Partial<EdgeOneKvBinding>;

  return typeof binding.delete === "function"
    && typeof binding.get === "function"
    && typeof binding.list === "function"
    && typeof binding.put === "function";
}

function readGlobalBinding(bindingName: string) {
  const binding = (globalThis as Record<string, unknown>)[bindingName];

  return isEdgeOneKvBinding(binding) ? binding : null;
}

function listGlobalBindingNames() {
  return Object.keys(globalThis)
    .filter((name) => isEdgeOneKvBinding((globalThis as Record<string, unknown>)[name]))
    .sort();
}

function sanitizeError(error: unknown) {
  return error instanceof Error ? error.message : "Unknown EdgeOne KV diagnostics error.";
}

async function readKeyStatuses(binding: EdgeOneKvBinding | null) {
  const statuses: Record<string, KeyStatus> = {};

  for (const name of runtimeEnvNames) {
    if (!binding) {
      statuses[name] = "unset";
      continue;
    }

    try {
      const value = await binding.get(name);
      statuses[name] = typeof value === "undefined" || value === null || value === "" ? "unset" : "set";
    } catch {
      statuses[name] = "error";
    }
  }

  return statuses;
}

async function probeStoreBinding(bindingName: string, binding: EdgeOneKvBinding | null) {
  if (!binding) {
    return {
      available: false,
      bindingName,
      probe: {
        deleted: false,
        read: false,
        written: false,
      },
    };
  }

  const db = createEdgeOneKvDbAdapter<{ marker: string }>({
    binding,
    namespace: "diagnostics",
  });
  const marker = `probe_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const key = `edgeone_kv_probe_${Date.now()}`;
  const probe = {
    deleted: false,
    read: false,
    written: false,
  };

  try {
    await db.set(key, { marker });
    probe.written = true;

    const value = await db.get(key);
    probe.read = value?.marker === marker;

    await db.del(key);
    probe.deleted = await db.get(key) === null;

    return {
      available: true,
      bindingName,
      probe,
    };
  } catch (error) {
    try {
      await db.del(key);
    } catch {
      // Keep the original probe error. Cleanup is best effort.
    }

    return {
      available: true,
      bindingName,
      error: sanitizeError(error),
      probe,
    };
  }
}

async function readBearerAdmin(request?: Request) {
  const authorization = request?.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const jwt = match?.[1]?.trim();

  if (!jwt) {
    return null;
  }

  const account = await getAccountByJwt(jwt);

  return account?.admin ? account : null;
}

export async function GET(request?: Request) {
  const session = await auth();
  const bearerAdmin = await readBearerAdmin(request);

  if (!session?.user && !bearerAdmin) {
    return new NextResponse(null, { status: 401 });
  }

  if (!session?.user?.admin && !bearerAdmin) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const envBindingName = defaultEnvBindingName;
  const envBinding = readGlobalBinding(envBindingName);
  const storeBindingNames = [
    defaultStoreBindingNames.cfg,
    defaultStoreBindingNames.cache,
    defaultStoreBindingNames.user,
  ];

  return NextResponse.json({
    bindingNames: listGlobalBindingNames(),
    envBinding: {
      available: Boolean(envBinding),
      bindingName: envBindingName,
      keys: await readKeyStatuses(envBinding),
    },
    storeBindings: await Promise.all(
      storeBindingNames.map((bindingName) => probeStoreBinding(bindingName, readGlobalBinding(bindingName))),
    ),
  });
}
