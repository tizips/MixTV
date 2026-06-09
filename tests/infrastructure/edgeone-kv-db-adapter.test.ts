import { describe, expect, it } from "vitest";
import {
  cleanupExpiredEdgeOneKvEntries,
  deleteEdgeOneKvEntry,
  deleteEdgeOneKvHashField,
  getEdgeOneKvBinding,
  listEdgeOneKvLogicalKeys,
  moveEdgeOneKvHashField,
  patchEdgeOneKvHash,
  readEdgeOneKvHash,
  readEdgeOneKvHashField,
  readEdgeOneKvJson,
  readEdgeOneKvList,
  readEdgeOneKvString,
  writeEdgeOneKvHash,
  writeEdgeOneKvJson,
  writeEdgeOneKvList,
  writeEdgeOneKvString,
  type EdgeOneKvBinding,
} from "@/infrastructure/db/edgeone-kv-db-adapter";
import { FakeEdgeOneKvBinding } from "../helpers/fake-edgeone-kv";

describe("edgeone kv helpers", () => {
  it("reads, writes, and deletes json values through encoded KV keys", async () => {
    const binding = new FakeEdgeOneKvBinding();

    await writeEdgeOneKvJson(binding, "movie:100", { id: "100", title: "Alpha" }, { namespace: "user" });
    await expect(readEdgeOneKvJson(binding, "movie:100", { namespace: "user" })).resolves.toEqual({
      id: "100",
      title: "Alpha",
    });

    await deleteEdgeOneKvEntry(binding, "movie:100", { namespace: "user" });
    await expect(readEdgeOneKvJson(binding, "movie:100", { namespace: "user" })).resolves.toBeNull();
  });

  it("reads, patches, deletes, and moves hash fields", async () => {
    const binding = new FakeEdgeOneKvBinding();

    await patchEdgeOneKvHash(binding, "user-1:fav", { "alpha:1": "favorite-1" }, { namespace: "user" });
    await patchEdgeOneKvHash(binding, "user-1:fav", { "beta:2": "favorite-2" }, { namespace: "user" });

    await expect(readEdgeOneKvHashField(binding, "user-1:fav", "alpha:1", { namespace: "user" })).resolves.toBe("favorite-1");
    await expect(readEdgeOneKvHash(binding, "user-1:fav", { namespace: "user" })).resolves.toEqual({
      "alpha:1": "favorite-1",
      "beta:2": "favorite-2",
    });

    await expect(
      moveEdgeOneKvHashField(binding, "user-1:fav", "alpha:1", "gamma:3", "favorite-3", { namespace: "user" }),
    ).resolves.toBe("favorite-3");
    await deleteEdgeOneKvHashField(binding, "user-1:fav", "beta:2", { namespace: "user" });

    await expect(readEdgeOneKvHash(binding, "user-1:fav", { namespace: "user" })).resolves.toEqual({
      "gamma:3": "favorite-3",
    });
  });

  it("reads and writes string, list, and complete hash envelopes", async () => {
    const binding = new FakeEdgeOneKvBinding();

    await writeEdgeOneKvString(binding, "cache:video:a:1", "detail", { ttlSeconds: 60 });
    await writeEdgeOneKvList(binding, "user-1:sh", ["沙丘", "庆余年"], { namespace: "user" });
    await writeEdgeOneKvHash(binding, "sources", { alpha: "source-1" }, { namespace: "admin" });

    await expect(readEdgeOneKvString(binding, "cache:video:a:1")).resolves.toBe("detail");
    await expect(readEdgeOneKvList(binding, "user-1:sh", { namespace: "user" })).resolves.toEqual(["沙丘", "庆余年"]);
    await expect(readEdgeOneKvHash(binding, "sources", { namespace: "admin" })).resolves.toEqual({ alpha: "source-1" });
  });

  it("lists logical keys and cleans expired envelopes without touching raw KV records", async () => {
    const binding = new FakeEdgeOneKvBinding();
    const now = 1768435200000;

    await writeEdgeOneKvString(binding, "cache:expired", "old", { now: () => now, ttlSeconds: 10 });
    await writeEdgeOneKvString(binding, "cache:fresh", "new", { now: () => now, ttlSeconds: 120 });
    await writeEdgeOneKvJson(binding, "user-1:pr", { retained: true }, { namespace: "user" });
    binding.values.set("external_raw_key", "leave me alone");

    await expect(listEdgeOneKvLogicalKeys(binding, { pattern: "*:pr" })).resolves.toEqual(["user:user-1:pr"]);

    await expect(cleanupExpiredEdgeOneKvEntries(binding, {
      expiresBefore: now + 20_000,
      pattern: "*",
    })).resolves.toEqual({ deleted: 1, scanned: 3 });
    await expect(readEdgeOneKvString(binding, "cache:expired")).resolves.toBeNull();
    await expect(readEdgeOneKvString(binding, "cache:fresh", { now: () => now + 20_000 })).resolves.toBe("new");
    expect(binding.values.get("external_raw_key")).toBe("leave me alone");
  });

  it("resolves a binding from globalThis by name", async () => {
    const binding = new FakeEdgeOneKvBinding();
    const globalWithBinding = globalThis as typeof globalThis & { mixtv_kv?: EdgeOneKvBinding };

    globalWithBinding.mixtv_kv = binding;
    try {
      expect(getEdgeOneKvBinding({ bindingName: "mixtv_kv" })).toBe(binding);
    } finally {
      delete globalWithBinding.mixtv_kv;
    }
  });
});
