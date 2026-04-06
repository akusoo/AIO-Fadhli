import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAuthedRouteContextMock,
  buildAppSnapshotMock,
  updateBudgetCycleMock,
} = vi.hoisted(() => ({
  getAuthedRouteContextMock: vi.fn(),
  buildAppSnapshotMock: vi.fn(),
  updateBudgetCycleMock: vi.fn(),
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
  updateBudgetCycle: updateBudgetCycleMock,
}));

import { PATCH } from "@/app/api/finance/budget-cycles/[cycleId]/route";

describe("PATCH /api/finance/budget-cycles/[cycleId]", () => {
  beforeEach(() => {
    getAuthedRouteContextMock.mockReset();
    buildAppSnapshotMock.mockReset();
    updateBudgetCycleMock.mockReset();
  });

  it("forwards auth guard responses", async () => {
    getAuthedRouteContextMock.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await PATCH(
      new Request("http://localhost/api/finance/budget-cycles/cycle-1", {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ cycleId: "cycle-1" }) },
    );

    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(401);
  });

  it("updates a budget cycle and returns snapshot", async () => {
    getAuthedRouteContextMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
      applyCookies: vi.fn(),
    });
    updateBudgetCycleMock.mockResolvedValue(undefined);
    buildAppSnapshotMock.mockResolvedValue({
      budgetCycles: [{ id: "cycle-1", label: "Siklus revisi" }],
    });

    const response = await PATCH(
      new Request("http://localhost/api/finance/budget-cycles/cycle-1", {
        method: "PATCH",
        body: JSON.stringify({
          label: "Siklus revisi",
          startOn: "2026-04-01",
          endOn: "2026-04-07",
          targetAmount: 900_000,
          status: "active",
        }),
      }),
      { params: Promise.resolve({ cycleId: "cycle-1" }) },
    );

    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(200);
    expect(updateBudgetCycleMock).toHaveBeenCalledWith(
      {},
      "user-1",
      expect.objectContaining({
        cycleId: "cycle-1",
        label: "Siklus revisi",
        targetAmount: 900_000,
      }),
    );
    await expect(response.json()).resolves.toEqual({
      snapshot: {
        budgetCycles: [{ id: "cycle-1", label: "Siklus revisi" }],
      },
    });
  });
});
