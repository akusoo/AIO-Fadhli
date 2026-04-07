import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAuthedRouteContextMock,
  createInvestmentWithSideEffectsMock,
  updateInvestmentMock,
  softDeleteByIdMock,
  addInvestmentValuationWithSideEffectsMock,
} = vi.hoisted(() => ({
  getAuthedRouteContextMock: vi.fn(),
  createInvestmentWithSideEffectsMock: vi.fn(),
  updateInvestmentMock: vi.fn(),
  softDeleteByIdMock: vi.fn(),
  addInvestmentValuationWithSideEffectsMock: vi.fn(),
}));

vi.mock("@/lib/server/routes", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/routes")>("@/lib/server/routes");
  return {
    ...actual,
    getAuthedRouteContext: getAuthedRouteContextMock,
  };
});

vi.mock("@/lib/server/app-backend", () => ({
  createInvestmentWithSideEffects: createInvestmentWithSideEffectsMock,
  updateInvestment: updateInvestmentMock,
  softDeleteById: softDeleteByIdMock,
  addInvestmentValuationWithSideEffects: addInvestmentValuationWithSideEffectsMock,
}));

import { POST as POSTInvestments } from "@/app/api/finance/investments/route";
import {
  DELETE as DELETEInvestment,
  PATCH as PATCHInvestment,
} from "@/app/api/finance/investments/[investmentId]/route";
import { POST as POSTInvestmentValuation } from "@/app/api/finance/investments/[investmentId]/valuations/route";

describe("finance investments routes", () => {
  beforeEach(() => {
    getAuthedRouteContextMock.mockReset();
    createInvestmentWithSideEffectsMock.mockReset();
    updateInvestmentMock.mockReset();
    softDeleteByIdMock.mockReset();
    addInvestmentValuationWithSideEffectsMock.mockReset();
  });

  it("forwards auth guard on create route", async () => {
    getAuthedRouteContextMock.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await POSTInvestments(
      new Request("http://localhost/api/finance/investments", {
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

  it("creates investment and returns item payload", async () => {
    getAuthedRouteContextMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
      applyCookies: vi.fn(),
    });
    createInvestmentWithSideEffectsMock.mockResolvedValue("inv-1");

    const response = await POSTInvestments(
      new Request("http://localhost/api/finance/investments", {
        method: "POST",
        body: JSON.stringify({
          name: "BBCA",
          platform: "Stockbit",
          instrument: "stock",
          startDate: "2026-04-02",
          investedAmount: 1_000_000,
          currentValue: 1_020_000,
          accountId: "acct-main",
        }),
      }),
    );

    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(200);
    expect(createInvestmentWithSideEffectsMock).toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      item: { investmentId: "inv-1" },
    });
  });

  it("patches and deletes investment", async () => {
    getAuthedRouteContextMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
      applyCookies: vi.fn(),
    });
    updateInvestmentMock.mockResolvedValue(undefined);
    softDeleteByIdMock.mockResolvedValue(undefined);

    const patchResponse = await PATCHInvestment(
      new Request("http://localhost/api/finance/investments/inv-1", {
        method: "PATCH",
        body: JSON.stringify({
          name: "BBCA",
          platform: "Stockbit",
          instrument: "stock",
          status: "active",
          accountId: "acct-main",
          tags: [],
        }),
      }),
      { params: Promise.resolve({ investmentId: "inv-1" }) },
    );

    expect(patchResponse).toBeDefined();
    if (!patchResponse) {
      throw new Error("Expected a response");
    }

    expect(patchResponse.status).toBe(200);
    expect(updateInvestmentMock).toHaveBeenCalled();
    await expect(patchResponse.json()).resolves.toEqual({
      item: { investmentId: "inv-1" },
    });

    const deleteResponse = await DELETEInvestment(
      new Request("http://localhost/api/finance/investments/inv-1", { method: "DELETE" }),
      { params: Promise.resolve({ investmentId: "inv-1" }) },
    );

    expect(deleteResponse).toBeDefined();
    if (!deleteResponse) {
      throw new Error("Expected a response");
    }

    expect(deleteResponse.status).toBe(200);
    expect(softDeleteByIdMock).toHaveBeenCalledWith({}, "investments", "user-1", "inv-1");
    await expect(deleteResponse.json()).resolves.toEqual({
      item: { investmentId: "inv-1" },
    });
  });

  it("adds valuation and returns item payload", async () => {
    getAuthedRouteContextMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
      applyCookies: vi.fn(),
    });
    addInvestmentValuationWithSideEffectsMock.mockResolvedValue(undefined);

    const response = await POSTInvestmentValuation(
      new Request("http://localhost/api/finance/investments/inv-1/valuations", {
        method: "POST",
        body: JSON.stringify({
          valuedOn: "2026-04-02",
          currentValue: 1_030_000,
          syncToTransaction: true,
        }),
      }),
      { params: Promise.resolve({ investmentId: "inv-1" }) },
    );

    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(200);
    expect(addInvestmentValuationWithSideEffectsMock).toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      item: { investmentId: "inv-1", valuedOn: "2026-04-02" },
    });
  });
});
