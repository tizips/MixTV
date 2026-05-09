// tests/shared/storage/storage-port-contract.test.ts
import { describe, expect, it } from "vitest";
import type { StoragePort } from "@/shared/storage/storage-port";

describe("StoragePort contract", () => {
  it("requires get/set/remove methods", () => {
    type Keys = keyof StoragePort;
    const keys: Keys[] = ["get", "set", "remove"];
    expect(keys).toEqual(["get", "set", "remove"]);
  });
});
