import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server, type Socket } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ensureEdgeOneKvBindingsForNode,
  readEdgeOneKvBindingsFromGeneratedSource,
  resetEdgeOneKvBindingsForTest,
} from "@/infrastructure/edgeone/node-kv-bindings";

const bindingConfigs = [
  {
    name: "env",
    namespace: "env-namespace",
    serviceName: "kv.example.com",
    servicePort: "80",
    type: "edgekv",
    userId: "user-id",
    userKey: "user-key",
  },
  {
    name: "user",
    namespace: "user-namespace",
    serviceName: "kv.example.com",
    servicePort: "80",
    type: "edgekv",
    userId: "user-id",
    userKey: "user-key",
  },
];

function clearBindings() {
  const globals = globalThis as Record<string, unknown>;

  delete globals.env;
  delete globals.user;
}

async function listen(server: Server) {
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Test server did not bind to a TCP port.");
  }

  return address.port;
}

async function closeServer(server: Server, sockets: Set<Socket>) {
  for (const socket of sockets) {
    socket.destroy();
  }

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
}

describe("EdgeOne node KV bindings", () => {
  afterEach(() => {
    clearBindings();
    resetEdgeOneKvBindingsForTest();
    vi.unstubAllEnvs();
  });

  it("reads KV binding metadata from the generated EdgeOne dev source", () => {
    const generatedSource = `context = { env: { "EO_KV_BINDINGS":${JSON.stringify(JSON.stringify(bindingConfigs))} } }`;

    expect(readEdgeOneKvBindingsFromGeneratedSource(generatedSource)).toEqual(bindingConfigs);
  });

  it("initializes global KV bindings from EdgeOne metadata without reading auth env values", () => {
    vi.stubEnv("EO_KV_BINDINGS", JSON.stringify(bindingConfigs));
    vi.stubEnv("AUTH_SECRET", "process-secret");
    vi.stubEnv("USERNAME", "process-admin");
    vi.stubEnv("PASSWORD", "process-password");

    ensureEdgeOneKvBindingsForNode();

    expect((globalThis as Record<string, unknown>).env).toEqual(expect.objectContaining({
      delete: expect.any(Function),
      get: expect.any(Function),
      list: expect.any(Function),
      put: expect.any(Function),
    }));
    expect((globalThis as Record<string, unknown>).user).toEqual(expect.objectContaining({
      delete: expect.any(Function),
      get: expect.any(Function),
      list: expect.any(Function),
      put: expect.any(Function),
    }));
  });

  it("falls back to the generated EdgeOne dev file when the process metadata env is unavailable", () => {
    const cwd = mkdtempSync(join(tmpdir(), "mixtv-edgeone-"));
    const edgeFunctionDir = join(cwd, ".edgeone", "edge-functions");

    mkdirSync(edgeFunctionDir, { recursive: true });
    writeFileSync(
      join(edgeFunctionDir, "index.js"),
      `context = { env: { "EO_KV_BINDINGS":${JSON.stringify(JSON.stringify(bindingConfigs))} } }`,
    );

    try {
      ensureEdgeOneKvBindingsForNode(cwd);

      expect((globalThis as Record<string, unknown>).env).toEqual(expect.objectContaining({
        get: expect.any(Function),
      }));
    } finally {
      rmSync(cwd, { force: true, recursive: true });
    }
  });

  it("authenticates and selects the namespace before sending KV commands", async () => {
    const commands: string[] = [];
    const sockets = new Set<Socket>();
    const server = createServer((socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
      socket.on("data", (chunk) => {
        const command = chunk.toString("utf8");
        commands.push(command);

        if (command.includes("\r\nAUTH\r\n") || command.includes("\r\nSELECT\r\n")) {
          socket.write("+OK\r\n");
          return;
        }

        socket.write("$12\r\nstored-value\r\n");
      });
    });
    const port = await listen(server);
    vi.stubEnv("EO_KV_BINDINGS", JSON.stringify([
      {
        name: "env",
        namespace: "env-namespace",
        serviceName: "127.0.0.1",
        servicePort: String(port),
        type: "edgekv",
        userId: "user-id",
        userKey: "user-key",
      },
    ]));

    ensureEdgeOneKvBindingsForNode();

    const binding = (globalThis as Record<string, { get(key: string): Promise<unknown> }>).env;
    const pendingValue = binding.get("AUTH_SECRET").catch((error: Error) => error.message);
    const value = await Promise.race([
      pendingValue,
      new Promise((resolve) => setTimeout(() => resolve("__timeout__"), 100)),
    ]);

    await closeServer(server, sockets);

    expect(value).toBe("stored-value");
    expect(commands.map((command) => command.match(/\r\n([A-Za-z]+)\r\n/)?.[1])).toEqual([
      "AUTH",
      "SELECT",
      "oget",
    ]);
  });

  it("decodes multibyte bulk string responses by byte length", async () => {
    const storedValue = JSON.stringify({
      kind: "hash",
      value: {
        source: JSON.stringify({
          name: "爱奇艺资源",
        }),
      },
      version: 1,
    });
    const commands: string[] = [];
    const sockets = new Set<Socket>();
    const server = createServer((socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
      socket.on("data", (chunk) => {
        const command = chunk.toString("utf8");
        commands.push(command);

        if (command.includes("\r\nAUTH\r\n") || command.includes("\r\nSELECT\r\n")) {
          socket.write("+OK\r\n");
          return;
        }

        socket.write(`$${Buffer.byteLength(storedValue, "utf8")}\r\n${storedValue}\r\n`);
      });
    });
    const port = await listen(server);
    vi.stubEnv("EO_KV_BINDINGS", JSON.stringify([
      {
        name: "env",
        namespace: "env-namespace",
        serviceName: "127.0.0.1",
        servicePort: String(port),
        type: "edgekv",
        userId: "user-id",
        userKey: "user-key",
      },
    ]));

    ensureEdgeOneKvBindingsForNode();

    const binding = (globalThis as Record<string, { get(key: string): Promise<unknown> }>).env;
    const pendingValue = binding.get("AUTH_SECRET").catch((error: Error) => error.message);
    const value = await Promise.race([
      pendingValue,
      new Promise((resolve) => setTimeout(() => resolve("__timeout__"), 100)),
    ]);

    await closeServer(server, sockets);

    expect(value).toBe(storedValue);
    expect(commands.map((command) => command.match(/\r\n([A-Za-z]+)\r\n/)?.[1])).toEqual([
      "AUTH",
      "SELECT",
      "oget",
    ]);
  });
});
