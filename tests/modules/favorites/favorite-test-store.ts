import type { EdgeOneKvBinding } from "@/infrastructure/db/edgeone-kv-db-adapter";
import { createEdgeOneKvHashStore } from "../../helpers/fake-edgeone-kv";

export type FavoriteTestStore = EdgeOneKvBinding;

export function createFavoriteTestStore(
  initialValues: Record<string, Record<string, unknown>> = {},
): Promise<FavoriteTestStore> {
  return createEdgeOneKvHashStore(initialValues, { namespace: "user" });
}
