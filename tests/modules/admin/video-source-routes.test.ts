import { describe, expect, it, vi } from "vitest";
import * as createRoute from "@/app/api/admin/video-source/route";
import * as batchRoute from "@/app/api/admin/video-source/batch/route";
import * as itemRoute from "@/app/api/admin/video-sources/[key]/route";

const createVideoSourceMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/admin/server/video-source-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/admin/server/video-source-service")>();

  return {
    ...actual,
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
    expect("POST" in batchRoute).toBe(false);
    expect("PUT" in batchRoute).toBe(true);
  });
});
