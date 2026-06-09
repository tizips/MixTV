import {
  getEdgeOneKvBinding,
  readEdgeOneKvJson,
  type EdgeOneKvBinding,
  writeEdgeOneKvJson,
} from "@/infrastructure/db/edgeone-kv-db-adapter";
import { AdminModuleValidationError } from "./admin-module-error";

export type AdminModulesStore = EdgeOneKvBinding;

const storeNamespace = "admin";
const storeKvBindingName = "cfg";

export function createAdminModulesStore(): AdminModulesStore {
  return getEdgeOneKvBinding({
    bindingName: storeKvBindingName,
  });
}

export function now() {
  return new Date().toISOString();
}

export function asObject(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new AdminModuleValidationError("Request body must be an object.");
  }

  return payload as Record<string, unknown>;
}

export function readString(payload: Record<string, unknown>, key: string): string;
export function readString(payload: Record<string, unknown>, key: string, required: false): string | undefined;
export function readString(payload: Record<string, unknown>, key: string, required = true) {
  const value = payload[key];

  if (typeof value !== "string") {
    if (!required) {
      return undefined;
    }

    throw new AdminModuleValidationError(`${key} is required.`);
  }

  return value.trim();
}

export function readBoolean(payload: Record<string, unknown>, key: string): boolean;
export function readBoolean(payload: Record<string, unknown>, key: string, required: false): boolean | undefined;
export function readBoolean(payload: Record<string, unknown>, key: string, required = true) {
  const value = payload[key];

  if (typeof value !== "boolean") {
    if (!required) {
      return undefined;
    }

    throw new AdminModuleValidationError(`${key} is required.`);
  }

  return value;
}

export function readNumber(payload: Record<string, unknown>, key: string, fallback: number, min: number, max: number) {
  const value = payload[key];
  const number = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(number)));
}

export async function getStored<T>(key: string, defaults: T, store: AdminModulesStore): Promise<T> {
  const stored = await readEdgeOneKvJson<Partial<T>>(store, key, { namespace: storeNamespace });
  return { ...defaults, ...stored };
}

export async function saveStored<T>(key: string, value: T, store: AdminModulesStore): Promise<T> {
  await writeEdgeOneKvJson(store, key, value, { namespace: storeNamespace });
  return value;
}
