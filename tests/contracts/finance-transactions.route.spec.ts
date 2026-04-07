import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAuthedRouteContextMock,
  createTransactionWithSideEffectsMock,
  updateTransactionWithSideEffectsMock,
  deleteTransactionWithSideEffectsMock,
} = vi.hoisted(() => ({
  getAuthedRouteContextMock: vi.fn(),
  createTransactionWithSideEffectsMock: vi.fn(),
  updateTransactionWithSideEffectsMock: vi.fn(),
  deleteTransactionWithSideEffectsMock: vi.fn(),
}));

vi.mock("@/lib/server/routes", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/routes")>("@/lib/server/routes");
  return {
    ...actual,
    getAuthedRouteContext: getAuthedRouteContextMock,
  };
});

vi.mock("@/lib/server/app-backend", () => ({
  createTransactionWithSideEffects: createTransactionWithSideEffectsMock,
  updateTransactionWithSideEffects: updateTransactionWithSideEffectsMock,
  deleteTransactionWithSideEffects: deleteTransactionWithSideEffectsMock,
}));

import { POST } from "@/app/api/finance/transactions/route";
import { DELETE, PATCH } from "@/app/api/finance/transactions/[transactionId]/route";

describe("POST /api/finance/transactions", () => {
  beforeEach(() => {
    getAuthedRouteContextMock.mockReset();
    createTransactionWithSideEffectsMock.mockReset();
    updateTransactionWithSideEffectsMock.mockReset();
    deleteTransactionWithSideEffectsMock.mockReset();
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

  it("returns transaction item when side effects succeed", async () => {
    getAuthedRouteContextMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
      applyCookies: vi.fn(),
    });
    createTransactionWithSideEffectsMock.mockResolvedValue("trx-1");

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
      item: { transactionId: "trx-1" },
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

  it("patches transactions and returns item payload", async () => {
    getAuthedRouteContextMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
      applyCookies: vi.fn(),
    });
    updateTransactionWithSideEffectsMock.mockResolvedValue(undefined);

    const response = await PATCH(
      new Request("http://localhost/api/finance/transactions/trx-1", {
        method: "PATCH",
        body: JSON.stringify({
          title: "Belanja baru",
          kind: "expense",
          amount: 25_000,
          occurredOn: "2026-04-03",
          accountId: "acct-main",
          categoryId: "cat-food",
        }),
      }),
      { params: Promise.resolve({ transactionId: "trx-1" }) },
    );

    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(200);
    expect(updateTransactionWithSideEffectsMock).toHaveBeenCalledWith(
      {},
      "user-1",
      expect.objectContaining({
        transactionId: "trx-1",
        title: "Belanja baru",
      }),
    );
    await expect(response.json()).resolves.toEqual({
      item: { transactionId: "trx-1" },
    });
  });

  it("deletes transactions and returns item payload", async () => {
    getAuthedRouteContextMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
      applyCookies: vi.fn(),
    });
    deleteTransactionWithSideEffectsMock.mockResolvedValue(undefined);

    const response = await DELETE(
      new Request("http://localhost/api/finance/transactions/trx-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ transactionId: "trx-1" }) },
    );

    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(200);
    expect(deleteTransactionWithSideEffectsMock).toHaveBeenCalledWith({}, "user-1", "trx-1");
    await expect(response.json()).resolves.toEqual({
      item: { transactionId: "trx-1" },
    });
  });

  it("returns 400 when deleting transactions fails", async () => {
    getAuthedRouteContextMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
      applyCookies: vi.fn(),
    });
    deleteTransactionWithSideEffectsMock.mockRejectedValue(
      new Error("Transaksi sinkron tidak bisa dihapus"),
    );

    const response = await DELETE(
      new Request("http://localhost/api/finance/transactions/trx-source", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ transactionId: "trx-source" }) },
    );

    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Transaksi sinkron tidak bisa dihapus",
    });
  });
});
