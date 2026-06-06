import { describe, expect, it, vi } from "vitest";
import * as createRoute from "@/app/api/admin/video-source/route";
import * as batchRoute from "@/app/api/admin/video-source/batch/route";
import * as validityCheckRoute from "@/app/api/admin/video-source/validity-check/route";
import * as itemRoute from "@/app/api/admin/video-sources/[key]/route";

const createVideoSourceMock = vi.hoisted(() => vi.fn());
const batchUpdateVideoSourcesMock = vi.hoisted(() => vi.fn());
const checkVideoSourceValiditiesMock = vi.hoisted(() => vi.fn());
const ensureEdgeOneKvBindingsForNodeMock = vi.hoisted(() => vi.fn());

vi.mock("@/infrastructure/edgeone/node-kv-bindings", () => ({
  ensureEdgeOneKvBindingsForNode: ensureEdgeOneKvBindingsForNodeMock,
}));

vi.mock("@/modules/admin/server/video-source-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/admin/server/video-source-service")>();

  return {
    ...actual,
    batchUpdateVideoSources: batchUpdateVideoSourcesMock,
    checkVideoSourceValidities: checkVideoSourceValiditiesMock,
    createVideoSource: createVideoSourceMock,
  };
});

describe("video source API routes", () => {
  it("creates video sources through the singular collection endpoint", async () => {
    createVideoSourceMock.mockResolvedValue({
      adult: false,
      apiUrl: "https://source.test/api",
      key: "new-source",
      name: "New Source",
      status: "enabled",
      type: "normal",
      updatedAt: "2026-05-14T00:00:00.000Z",
      validity: "warning",
      weight: 12,
    });

    const response = await createRoute.POST(
      new Request("http://localhost/api/admin/video-source", {
        body: JSON.stringify({
          adult: false,
          apiUrl: "https://source.test/api",
          key: "new-source",
          name: "New Source",
          status: "enabled",
          type: "normal",
          weight: 12,
        }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      apiUrl: "https://source.test/api",
      key: "new-source",
      name: "New Source",
      status: "enabled",
    });
    expect(createVideoSourceMock).toHaveBeenCalledWith({
      adult: false,
      apiUrl: "https://source.test/api",
      key: "new-source",
      name: "New Source",
      status: "enabled",
      type: "normal",
      weight: 12,
    });
  });

  it("updates video sources with PUT on the plural item endpoint", async () => {
    expect("PATCH" in itemRoute).toBe(false);
    expect("PUT" in itemRoute).toBe(true);
  });

  it("batch updates video sources with PUT on the singular batch endpoint", async () => {
    batchUpdateVideoSourcesMock.mockResolvedValue({
      sources: [],
      updatedAt: null,
    });

    expect("POST" in batchRoute).toBe(false);
    expect("PUT" in batchRoute).toBe(true);

    const response = await batchRoute.PUT(
      new Request("http://localhost/api/admin/video-source/batch", {
        body: JSON.stringify({
          action: "disable",
          keys: ["alpha", "beta"],
        }),
        method: "PUT",
      }),
    );

    expect(response.status).toBe(200);
    expect(batchUpdateVideoSourcesMock).toHaveBeenCalledWith({
      action: "disable",
      keys: ["alpha", "beta"],
    });
  });

  it("streams video source validity check results as SSE", async () => {
    checkVideoSourceValiditiesMock.mockImplementation(async (_input, options) => {
      options.onStart?.({ total: 1 });
      options.onResult?.({
        apiUrl: "https://source.test/api",
        key: "alpha",
        name: "Alpha",
        validity: "valid",
      });
      return {
        sources: [
          {
            adult: false,
            apiUrl: "https://source.test/api",
            key: "alpha",
            name: "Alpha",
            no: 1,
            status: "enabled",
            type: "normal",
            updatedAt: "2026-05-15T00:00:00.000Z",
            validity: "valid",
            weight: 10,
          },
        ],
        updatedAt: "2026-05-15T00:00:00.000Z",
      };
    });

    const response = await validityCheckRoute.GET(
      new Request("http://localhost/api/admin/video-source/validity-check?keyword=movie"),
    );
    const body = await response.text();

    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(body).toContain("event: start");
    expect(body).toContain('"total":1');
    expect(body).toContain("event: result");
    expect(body).toContain('"key":"alpha"');
    expect(body).toContain("event: complete");
    expect(checkVideoSourceValiditiesMock).toHaveBeenCalledWith(
      { keyword: "movie" },
      expect.objectContaining({
        onResult: expect.any(Function),
        onStart: expect.any(Function),
      }),
    );
    expect(ensureEdgeOneKvBindingsForNodeMock).toHaveBeenCalled();
  });
});
