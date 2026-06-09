import {
  readEdgeOneKvHash,
  readEdgeOneKvString,
  type EdgeOneKvBinding,
  type EdgeOneKvRecordOptions,
  type EdgeOneKvWriteOptions,
  writeEdgeOneKvHash,
  writeEdgeOneKvString,
} from "@/infrastructure/db/edgeone-kv-db-adapter";

export class FakeEdgeOneKvBinding implements EdgeOneKvBinding {
  readonly values = new Map<string, string>();

  constructor(initialValues: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(initialValues)) {
      this.values.set(key, value);
    }
  }

  async delete(key: string) {
    this.values.delete(key);
  }

  async get(key: string) {
    return this.values.get(key) ?? null;
  }

  async list(options: { cursor?: string; limit?: number; prefix?: string } = {}) {
    const keys = [...this.values.keys()]
      .filter((key) => !options.prefix || key.startsWith(options.prefix))
      .sort();

    return {
      keys: keys.map((name) => ({ name })),
      list_complete: true,
    };
  }

  async put(key: string, value: string) {
    this.values.set(key, value);
  }
}

export function stringifyHashValues(values: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).map(([field, value]) => [
      field,
      typeof value === "string" ? value : JSON.stringify(value),
    ]),
  );
}

export async function seedEdgeOneKvHash(
  binding: EdgeOneKvBinding,
  key: string,
  values: Record<string, unknown>,
  options: EdgeOneKvWriteOptions = {},
) {
  await writeEdgeOneKvHash(binding, key, stringifyHashValues(values), options);
}

export async function createEdgeOneKvHashStore(
  initialValues: Record<string, Record<string, unknown>> = {},
  options: EdgeOneKvWriteOptions = {},
) {
  const binding = new FakeEdgeOneKvBinding();

  for (const [key, value] of Object.entries(initialValues)) {
    await seedEdgeOneKvHash(binding, key, value, options);
  }

  return binding;
}

export async function createEdgeOneKvStringStore(
  initialValues: Record<string, unknown> = {},
  options: EdgeOneKvWriteOptions = {},
) {
  const binding = new FakeEdgeOneKvBinding();

  for (const [key, value] of Object.entries(initialValues)) {
    await writeEdgeOneKvString(binding, key, typeof value === "string" ? value : JSON.stringify(value), options);
  }

  return binding;
}

export async function dumpEdgeOneKvHash(
  binding: EdgeOneKvBinding,
  key: string,
  options: EdgeOneKvRecordOptions = {},
) {
  return readEdgeOneKvHash(binding, key, options);
}

export async function dumpEdgeOneKvString(
  binding: EdgeOneKvBinding,
  key: string,
  options: EdgeOneKvRecordOptions = {},
) {
  return readEdgeOneKvString(binding, key, options);
}
