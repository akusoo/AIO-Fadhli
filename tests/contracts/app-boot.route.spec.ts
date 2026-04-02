import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthedRouteContextMock, buildAppSnapshotMock } = vi.hoisted(() => ({
  getAuthedRouteContextMock: vi.fn(),
  buildAppSnapshotMock: vi.fn(),
}));

vi.mock("@/lib/server/routes", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/routes")>("@/lib/server/routes");
  return {
    ...actual,
    getAuthedRouteContext: getAuthedRouteContextMock,
  };
});

vi.mock("@/lib/server/app-backend", () => ({
  buildAppSnapshot: buildAppSnapshotMock,
}));

import { GET } from "@/app/api/app/boot/route";

describe("GET /api/app/boot", () => {
  beforeEach(() => {
    getAuthedRouteContextMock.mockReset();
    buildAppSnapshotMock.mockReset();
  });

  it("forwards auth/env guard responses", async () => {
    getAuthedRouteContextMock.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await GET();
    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns backend snapshot on success", async () => {
    getAuthedRouteContextMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
      applyCookies: vi.fn(),
    });
    buildAppSnapshotMock.mockResolvedValue({ tasks: [], accounts: [] });

    const response = await GET();
    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      snapshot: { tasks: [], accounts: [] },
    });
  });

  it("maps backend failures to 500 responses", async () => {
    getAuthedRouteContextMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
      applyCookies: vi.fn(),
    });
    buildAppSnapshotMock.mockRejectedValue(new Error("boom"));

    const response = await GET();
    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "boom" });
  });
});
