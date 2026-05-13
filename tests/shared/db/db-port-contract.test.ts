import { describe, expect, it } from "vitest";
import type { DbPort } from "@/shared/db/db-port";

describe("DbPort contract", () => {
  it("requires set/get/del methods", () => {
    type Port = DbPort<unknown, unknown>;
    type Keys = keyof Port;

    const keys: Keys[] = ["set", "get", "del"];
    expect(keys).toEqual(["set", "get", "del"]);
  });
});
