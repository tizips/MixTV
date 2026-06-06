import { existsSync, readFileSync } from "node:fs";
import { createConnection, type Socket } from "node:net";
import { join } from "node:path";
import type { EdgeOneKvBinding } from "@/infrastructure/db/edgeone-kv-db-adapter";

type EdgeOneKvBindingConfig = {
  name: string;
  namespace: string;
  serviceName: string;
  servicePort: number | string;
  type?: string;
  userId: string;
  userKey: string;
};

type RespValue =
  | { type: "array"; value: RespValue[] }
  | { type: "bulk_string"; value: string }
  | { type: "error"; value: string }
  | { type: "integer"; value: number }
  | { type: "null"; value: null }
  | { type: "simple_string"; value: string };

type PendingResponse = {
  reject(error: Error): void;
  resolve(value: RespValue): void;
};

const edgeOneKvBindingsEnvName = "EO_KV_BINDINGS";
const generatedEdgeFunctionPath = join(".edgeone", "edge-functions", "index.js");
const edgeOneKeyPattern = /^[a-zA-Z0-9_]+$/;
const maxEdgeOneKeyBytes = 512;
const maxEdgeOneValueBytes = 26_214_400;

let initialized = false;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isEdgeOneKvBinding(value: unknown): value is EdgeOneKvBinding {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.delete === "function"
    && typeof value.get === "function"
    && typeof value.list === "function"
    && typeof value.put === "function";
}

function isEdgeOneKvBindingConfig(value: unknown): value is EdgeOneKvBindingConfig {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.name === "string"
    && typeof value.namespace === "string"
    && typeof value.serviceName === "string"
    && (typeof value.servicePort === "string" || typeof value.servicePort === "number")
    && typeof value.userId === "string"
    && typeof value.userKey === "string";
}

function decodeEdgeOneKvBindings(rawValue: string | undefined) {
  if (!rawValue) {
    return [];
  }

  for (const candidate of [
    rawValue,
    Buffer.from(rawValue, "base64").toString("utf8"),
  ]) {
    try {
      const parsed: unknown = JSON.parse(candidate);

      if (Array.isArray(parsed)) {
        return parsed.filter(isEdgeOneKvBindingConfig);
      }
    } catch {
      // Try the next supported encoding.
    }
  }

  return [];
}

export function readEdgeOneKvBindingsFromGeneratedSource(source: string) {
  const match = source.match(/"EO_KV_BINDINGS":"((?:\\.|[^"\\])*)"/);

  if (!match?.[1]) {
    return [];
  }

  try {
    return decodeEdgeOneKvBindings(JSON.parse(`"${match[1]}"`) as string);
  } catch {
    return [];
  }
}

function readGeneratedEdgeOneKvBindings(cwd: string) {
  const filePath = join(cwd, generatedEdgeFunctionPath);

  if (!existsSync(filePath)) {
    return [];
  }

  return readEdgeOneKvBindingsFromGeneratedSource(readFileSync(filePath, "utf8"));
}

function readEdgeOneKvBindingConfigs(cwd: string) {
  const envConfigs = decodeEdgeOneKvBindings(process.env[edgeOneKvBindingsEnvName]);

  return envConfigs.length > 0 ? envConfigs : readGeneratedEdgeOneKvBindings(cwd);
}

function encodeCommand(parts: Array<Buffer | string>) {
  const chunks: Buffer[] = [Buffer.from(`*${parts.length}\r\n`)];

  for (const part of parts) {
    const value = typeof part === "string" ? Buffer.from(part, "utf8") : part;

    chunks.push(Buffer.from(`$${value.length}\r\n`));
    chunks.push(value);
    chunks.push(Buffer.from("\r\n"));
  }

  return Buffer.concat(chunks);
}

class RespDecoder {
  private buffer = Buffer.alloc(0);

  append(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
  }

  parse(): RespValue | null {
    if (this.buffer.length === 0) {
      return null;
    }

    const type = String.fromCharCode(this.buffer[0] ?? 0);
    const lineEnd = this.buffer.indexOf("\r\n");

    if (lineEnd === -1) {
      return null;
    }

    const line = this.buffer.subarray(1, lineEnd).toString("utf8");

    if (type === "+") {
      this.buffer = this.buffer.subarray(lineEnd + 2);

      return { type: "simple_string", value: line };
    }

    if (type === "-") {
      this.buffer = this.buffer.subarray(lineEnd + 2);

      return { type: "error", value: line };
    }

    if (type === ":") {
      this.buffer = this.buffer.subarray(lineEnd + 2);

      return { type: "integer", value: Number.parseInt(line, 10) };
    }

    if (type === "$") {
      return this.parseBulkString(line, lineEnd);
    }

    if (type === "*") {
      return this.parseArray(line, lineEnd);
    }

    throw new Error("Unknown EdgeOne KV response type.");
  }

  private parseBulkString(line: string, lineEnd: number): RespValue | null {
    const length = Number.parseInt(line, 10);

    if (length === -1) {
      this.buffer = this.buffer.subarray(lineEnd + 2);

      return { type: "null", value: null };
    }

    const valueStart = lineEnd + 2;
    const valueEnd = valueStart + length;
    const messageEnd = valueEnd + 2;

    if (this.buffer.length < messageEnd) {
      return null;
    }

    const value = this.buffer.subarray(valueStart, valueEnd).toString("utf8");
    this.buffer = this.buffer.subarray(messageEnd);

    return { type: "bulk_string", value };
  }

  private parseArray(line: string, lineEnd: number): RespValue | null {
    const length = Number.parseInt(line, 10);

    if (length === -1) {
      this.buffer = this.buffer.subarray(lineEnd + 2);

      return { type: "null", value: null };
    }

    const originalBuffer = this.buffer;
    const values: RespValue[] = [];

    this.buffer = this.buffer.subarray(lineEnd + 2);

    for (let index = 0; index < length; index += 1) {
      const value = this.parse();

      if (!value) {
        this.buffer = originalBuffer;

        return null;
      }

      values.push(value);
    }

    return { type: "array", value: values };
  }
}

class EdgeOneKvConnection {
  private connected = false;
  private connecting: Promise<void> | null = null;
  private readonly decoder = new RespDecoder();
  private readonly pendingResponses: PendingResponse[] = [];
  private socket: Socket | null = null;

  constructor(
    private readonly config: EdgeOneKvBindingConfig,
  ) {}

  async send(parts: Array<Buffer | string>) {
    await this.connect();

    return new Promise<RespValue>((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error("EdgeOne KV connection is not available."));
        return;
      }

      this.pendingResponses.push({ reject, resolve });
      this.socket.write(encodeCommand(parts), (error) => {
        if (error) {
          reject(error);
        }
      });
    });
  }

  private async connect() {
    if (this.connected) {
      return;
    }

    if (this.connecting) {
      return this.connecting;
    }

    this.connecting = new Promise<void>((resolve, reject) => {
      const socket = createConnection({
        host: this.config.serviceName,
        port: Number(this.config.servicePort),
      });

      socket.setTimeout(10_000);
      socket.on("connect", async () => {
        this.connected = true;
        this.socket = socket;

        try {
          await this.authenticate();
          await this.selectNamespace();
          resolve();
        } catch (error) {
          this.close();
          reject(error instanceof Error ? error : new Error("EdgeOne KV connection failed."));
        }
      });
      socket.on("data", (chunk) => {
        this.decoder.append(chunk);
        this.processResponses();
      });
      socket.on("error", (error) => {
        this.rejectPending(error);
        reject(error);
      });
      socket.on("close", () => {
        this.connected = false;
        this.socket = null;
        this.rejectPending(new Error("EdgeOne KV connection closed."));
      });
      socket.on("timeout", () => {
        this.close();
        reject(new Error("EdgeOne KV connection timed out."));
      });
    }).finally(() => {
      this.connecting = null;
    });

    return this.connecting;
  }

  private async authenticate() {
    const response = await this.send([
      "AUTH",
      `${this.config.userId}@${this.config.userKey}`,
    ]);

    if (response.type !== "simple_string" || response.value !== "OK") {
      throw new Error("EdgeOne KV authentication failed.");
    }
  }

  private close() {
    this.socket?.end();
    this.socket = null;
    this.connected = false;
  }

  private processResponses() {
    let value = this.decoder.parse();

    while (value) {
      const pendingResponse = this.pendingResponses.shift();

      if (pendingResponse) {
        if (value.type === "error") {
          pendingResponse.reject(new Error(value.value));
        } else {
          pendingResponse.resolve(value);
        }
      }

      value = this.decoder.parse();
    }
  }

  private rejectPending(error: Error) {
    while (this.pendingResponses.length > 0) {
      this.pendingResponses.shift()?.reject(error);
    }
  }

  private async selectNamespace() {
    const response = await this.send(["SELECT", this.config.namespace]);

    if (response.type !== "simple_string" || response.value !== "OK") {
      throw new Error("EdgeOne KV namespace selection failed.");
    }
  }
}

function toBuffer(value: unknown) {
  if (typeof value === "string") {
    return Buffer.from(value, "utf8");
  }

  if (value instanceof ArrayBuffer) {
    return Buffer.from(value);
  }

  if (ArrayBuffer.isView(value)) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }

  throw new Error(`Unsupported EdgeOne KV value type: ${typeof value}`);
}

function readBulkString(response: RespValue) {
  if (response.type === "null") {
    return null;
  }

  if (response.type === "bulk_string") {
    return response.value;
  }

  if (response.type === "array" && response.value.length > 0) {
    const firstValue = response.value[0];

    return firstValue?.type === "bulk_string" ? firstValue.value : null;
  }

  return null;
}

function formatKey(config: EdgeOneKvBindingConfig, key: string) {
  return `/${config.namespace}/${key}`;
}

function createEdgeOneKvBinding(config: EdgeOneKvBindingConfig): EdgeOneKvBinding {
  const connection = new EdgeOneKvConnection(config);

  return {
    async delete(key: string) {
      await connection.send(["odel", formatKey(config, key)]);
    },
    async get(key: string, options?: { type?: string } | string) {
      const value = readBulkString(await connection.send(["oget", formatKey(config, key)]));

      if (value === null) {
        return null;
      }

      const type = typeof options === "string" ? options : options?.type;

      if (type === "json") {
        return JSON.parse(value);
      }

      return value;
    },
    async list(options = {}) {
      const prefix = formatKey(config, options.prefix ?? "");
      const limit = options.limit ?? 10;
      const parts = ["list", prefix, "count", String(limit)];

      if (options.cursor) {
        parts.push("cursor", formatKey(config, options.cursor));
      }

      const response = await connection.send(parts);

      if (response.type !== "array") {
        return { keys: [], list_complete: true };
      }

      const values = response.value;
      const cursor = values[0]?.type === "bulk_string"
        ? values[0].value.replace(`/${config.namespace}/`, "")
        : undefined;
      const listComplete = values[1]?.type === "bulk_string"
        ? values[1].value.toLowerCase() === "true"
        : true;
      const keys: Array<{ name: string }> = [];

      for (let index = 2; index < values.length; index += 3) {
        const item = values[index];

        if (item?.type === "bulk_string") {
          keys.push({ name: item.value.replace(`/${config.namespace}/`, "") });
        }
      }

      return {
        cursor,
        keys,
        list_complete: listComplete,
      };
    },
    async put(key: string, value: string) {
      const encodedKey = formatKey(config, key);
      const encodedValue = toBuffer(value);

      if (!edgeOneKeyPattern.test(key) || Buffer.byteLength(key, "utf8") > maxEdgeOneKeyBytes) {
        throw new Error("EdgeOne KV key is invalid.");
      }

      if (encodedValue.length > maxEdgeOneValueBytes) {
        throw new Error("EdgeOne KV value is too large.");
      }

      await connection.send(["oset", encodedKey, encodedValue]);
    },
  };
}

export function ensureEdgeOneKvBindingsForNode(cwd = process.cwd()) {
  if (initialized) {
    return;
  }

  const globalRecord = globalThis as Record<string, unknown>;

  for (const config of readEdgeOneKvBindingConfigs(cwd)) {
    if (!isEdgeOneKvBinding(globalRecord[config.name])) {
      globalRecord[config.name] = createEdgeOneKvBinding(config);
    }
  }

  initialized = true;
}

export function resetEdgeOneKvBindingsForTest() {
  initialized = false;
}
