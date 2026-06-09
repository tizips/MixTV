import type { EdgeOneKvBinding } from "@/infrastructure/db/edgeone-kv-db-adapter";
import { FakeEdgeOneKvBinding } from "../../helpers/fake-edgeone-kv";

export function createScriptSearchHistoryStore(): EdgeOneKvBinding {
  return new FakeEdgeOneKvBinding();
}
