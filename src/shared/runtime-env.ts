import type { EdgeOneKvBinding } from "@/infrastructure/db/edgeone-kv-db-adapter";

export type RuntimeEnv = Record<string, string | undefined>;

const defaultEnvKvBindingName = "env";
const runtimeEnvCacheMs = 30_000;
const runtimeEnvAliases: Record<string, string[]> = {
  AUTH_SECRET: ["auth_secret"],
  AUTH_URL: ["auth_url"],
  CRON_BASE_URL: ["cron_base_url"],
  NEXTAUTH_SECRET: ["nextauth_secret"],
  NEXTAUTH_URL: ["nextauth_url"],
  NEXT_PUBLIC_SITE_NAME: ["site_name", "next_public_site_name"],
  PASSWORD: ["password"],
  USERNAME: ["username"],
};

let cachedEnv: {
  expiresAt: number;
  namesKey: string;
  value: RuntimeEnv;
} | null = null;

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

function readEnvKvBinding() {
  const binding = (globalThis as Record<string, unknown>)[defaultEnvKvBindingName];

  return isEdgeOneKvBinding(binding) ? binding : null;
}

function normalizeKvValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return undefined;
}

function createNamesKey(names: string[]) {
  return [...new Set(names)].sort().join("\0");
}

function createLookupNames(name: string) {
  return [
    ...new Set([
      name,
      ...(runtimeEnvAliases[name] ?? []),
      name.toLowerCase(),
    ]),
  ];
}

export async function getRuntimeEnv(names: string[] = []): Promise<RuntimeEnv> {
  const normalizedNames = [...new Set(names.map((name) => name.trim()).filter((name) => name.length > 0))];
  const namesKey = createNamesKey(normalizedNames);
  const now = Date.now();

  if (cachedEnv && cachedEnv.namesKey === namesKey && cachedEnv.expiresAt > now) {
    return cachedEnv.value;
  }

  const value: RuntimeEnv = {};

  for (const name of normalizedNames) {
    value[name] = undefined;
  }

  const binding = readEnvKvBinding();

  if (binding) {
    await Promise.all(
      normalizedNames.map(async (name) => {
        for (const lookupName of createLookupNames(name)) {
          const kvValue = normalizeKvValue(await binding.get(lookupName));

          if (typeof kvValue === "string" && kvValue.length > 0) {
            value[name] = kvValue;
            break;
          }
        }
      }),
    );
  }

  cachedEnv = {
    expiresAt: now + runtimeEnvCacheMs,
    namesKey,
    value,
  };

  return value;
}

export async function getRuntimeEnvValue(name: string) {
  return (await getRuntimeEnv([name]))[name];
}

export function resetRuntimeEnvCacheForTest() {
  cachedEnv = null;
}
