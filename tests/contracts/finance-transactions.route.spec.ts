import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAuthedRouteContextMock,
  buildAppSnapshotMock,
  createTransactionWithSideEffectsMock,
} = vi.hoisted(() => ({
  getAuthedRouteContextMock: vi.fn(),
  buildAppSnapshotMock: vi.fn(),
  createTransactionWithSideEffectsMock: vi.fn(),
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
  createTransactionWithSideEffects: createTransactionWithSideEffectsMock,
}));

import { POST } from "@/app/api/finance/transactions/route";

describe("POST /api/finance/transactions", () => {
  beforeEach(() => {
    getAuthedRouteContextMock.mockReset();
    buildAppSnapshotMock.mockReset();
    createTransactionWithSideEffectsMock.mockReset();
  });

  it("forwards auth guard responses", async () => {
    getAuthedRouteContextMock.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await POST(
      new Request("http://localhost/api/finance/transactions", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(401);
  });

  it("returns snapshot when side effects succeed", async () => {
    getAuthedRouteContextMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
      applyCookies: vi.fn(),
    });
    createTransactionWithSideEffectsMock.mockResolvedValue("trx-1");
    buildAppSnapshotMock.mockResolvedValue({ transactions: [{ id: "trx-1" }] });

    const response = await POST(
      new Request("http://localhost/api/finance/transactions", {
        method: "POST",
        body: JSON.stringify({
          title: "Belanja",
          kind: "expense",
          amount: 10_000,
          occurredOn: "2026-04-02",
          accountId: "acct-main",
        }),
      }),
    );
    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(200);
    expect(createTransactionWithSideEffectsMock).toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      snapshot: { transactions: [{ id: "trx-1" }] },
    });
  });

  it("returns 400 when side effects fail", async () => {
    getAuthedRouteContextMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
      applyCookies: vi.fn(),
    });
    createTransactionWithSideEffectsMock.mockRejectedValue(new Error("duplicate source"));

    const response = await POST(
      new Request("http://localhost/api/finance/transactions", {
        method: "POST",
        body: JSON.stringify({
          title: "Belanja",
          kind: "expense",
          amount: 10_000,
          occurredOn: "2026-04-02",
          accountId: "acct-main",
        }),
      }),
    );
    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "duplicate source" });
  });
});
