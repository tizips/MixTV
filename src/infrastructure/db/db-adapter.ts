import { createEdgeOneKvDbAdapter, type EdgeOneKvBinding } from "@/infrastructure/db/edgeone-kv-db-adapter";
import type { DbPort } from "@/shared/db/db-port";

export interface DbAdapterOptions {
  client?: EdgeOneKvBinding;
  namespace: string;
}

const defaultEdgeOneKvBindings = {
  cache: "cache",
  cfg: "cfg",
  user: "user",
};

function resolveEdgeOneKvBindingName(namespace: string) {
  const normalizedNamespace = namespace.trim();

  if (normalizedNamespace === "admin") {
    return defaultEdgeOneKvBindings.cfg;
  }

  if (normalizedNamespace === "cache" || normalizedNamespace === "stats" || normalizedNamespace === "") {
    return defaultEdgeOneKvBindings.cache;
  }

  return defaultEdgeOneKvBindings.user;
}

export const createDbAdapter = <TValue>(
  options: DbAdapterOptions,
): DbPort<TValue, string> => createEdgeOneKvDbAdapter<TValue>({
  binding: options.client,
  bindingName: resolveEdgeOneKvBindingName(options.namespace),
  namespace: options.namespace,
});
