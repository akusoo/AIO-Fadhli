import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAuthedRouteContextMock,
  buildAppSnapshotMock,
  createAccountMock,
  updateAccountMock,
} = vi.hoisted(() => ({
  getAuthedRouteContextMock: vi.fn(),
  buildAppSnapshotMock: vi.fn(),
  createAccountMock: vi.fn(),
  updateAccountMock: vi.fn(),
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
  createAccount: createAccountMock,
  updateAccount: updateAccountMock,
}));

import { POST } from "@/app/api/finance/accounts/route";
import { PATCH } from "@/app/api/finance/accounts/[accountId]/route";

describe("Finance accounts routes", () => {
  beforeEach(() => {
    getAuthedRouteContextMock.mockReset();
    buildAppSnapshotMock.mockReset();
    createAccountMock.mockReset();
    updateAccountMock.mockReset();
  });

  it("creates account and returns snapshot", async () => {
    getAuthedRouteContextMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
      applyCookies: vi.fn(),
    });
    createAccountMock.mockResolvedValue("acct-1");
    buildAppSnapshotMock.mockResolvedValue({ accounts: [{ id: "acct-1", name: "Jago" }] });

    const response = await POST(
      new Request("http://localhost/api/finance/accounts", {
        method: "POST",
        body: JSON.stringify({
          name: "Jago",
          type: "bank",
          balance: 200_000,
        }),
      }),
    );

    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(200);
    expect(createAccountMock).toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      snapshot: { accounts: [{ id: "acct-1", name: "Jago" }] },
    });
  });

  it("updates account and returns snapshot", async () => {
    getAuthedRouteContextMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
      applyCookies: vi.fn(),
    });
    updateAccountMock.mockResolvedValue(undefined);
    buildAppSnapshotMock.mockResolvedValue({ accounts: [{ id: "acct-main", name: "BCA" }] });

    const response = await PATCH(
      new Request("http://localhost/api/finance/accounts/acct-main", {
        method: "PATCH",
        body: JSON.stringify({
          name: "BCA",
          type: "bank",
          balance: 500_000,
        }),
      }),
      { params: Promise.resolve({ accountId: "acct-main" }) },
    );

    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(200);
    expect(updateAccountMock).toHaveBeenCalledWith(
      {},
      "user-1",
      expect.objectContaining({
        accountId: "acct-main",
        name: "BCA",
      }),
    );
    await expect(response.json()).resolves.toEqual({
      snapshot: { accounts: [{ id: "acct-main", name: "BCA" }] },
    });
  });

  it("forwards auth response from guard", async () => {
    getAuthedRouteContextMock.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await PATCH(
      new Request("http://localhost/api/finance/accounts/acct-main", {
        method: "PATCH",
      }),
      { params: Promise.resolve({ accountId: "acct-main" }) },
    );

    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(401);
  });
});
