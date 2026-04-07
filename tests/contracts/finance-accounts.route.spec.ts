import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAuthedRouteContextMock,
  createAccountMock,
  deleteAccountWithSideEffectsMock,
  updateAccountMock,
} = vi.hoisted(() => ({
  getAuthedRouteContextMock: vi.fn(),
  createAccountMock: vi.fn(),
  deleteAccountWithSideEffectsMock: vi.fn(),
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
  createAccount: createAccountMock,
  deleteAccountWithSideEffects: deleteAccountWithSideEffectsMock,
  updateAccount: updateAccountMock,
}));

import { POST } from "@/app/api/finance/accounts/route";
import { DELETE, PATCH } from "@/app/api/finance/accounts/[accountId]/route";

describe("Finance accounts routes", () => {
  beforeEach(() => {
    getAuthedRouteContextMock.mockReset();
    createAccountMock.mockReset();
    deleteAccountWithSideEffectsMock.mockReset();
    updateAccountMock.mockReset();
  });

  it("creates account and returns item payload", async () => {
    getAuthedRouteContextMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
      applyCookies: vi.fn(),
    });
    createAccountMock.mockResolvedValue("acct-1");

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
      item: { accountId: "acct-1" },
    });
  });

  it("updates account and returns item payload", async () => {
    getAuthedRouteContextMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
      applyCookies: vi.fn(),
    });
    updateAccountMock.mockResolvedValue(undefined);

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
      item: { accountId: "acct-main" },
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

  it("deletes account and returns item payload", async () => {
    getAuthedRouteContextMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
      applyCookies: vi.fn(),
    });
    deleteAccountWithSideEffectsMock.mockResolvedValue(undefined);

    const response = await DELETE(
      new Request("http://localhost/api/finance/accounts/acct-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ accountId: "acct-1" }) },
    );

    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(200);
    expect(deleteAccountWithSideEffectsMock).toHaveBeenCalledWith({}, "user-1", "acct-1");
    await expect(response.json()).resolves.toEqual({
      item: { accountId: "acct-1" },
    });
  });
});
