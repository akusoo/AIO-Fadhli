import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAuthedRouteContextMock,
  deleteShoppingItemWithSideEffectsMock,
  moveShoppingToWishlistWithSideEffectsMock,
} = vi.hoisted(() => ({
  getAuthedRouteContextMock: vi.fn(),
  deleteShoppingItemWithSideEffectsMock: vi.fn(),
  moveShoppingToWishlistWithSideEffectsMock: vi.fn(),
}));

vi.mock("@/lib/server/routes", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/routes")>("@/lib/server/routes");
  return {
    ...actual,
    getAuthedRouteContext: getAuthedRouteContextMock,
  };
});

vi.mock("@/lib/server/app-backend", () => ({
  deleteShoppingItemWithSideEffects: deleteShoppingItemWithSideEffectsMock,
  moveShoppingToWishlistWithSideEffects: moveShoppingToWishlistWithSideEffectsMock,
}));

import { DELETE as DELETEShoppingItem } from "@/app/api/shopping/[itemId]/route";
import { POST as POSTMoveToWishlist } from "@/app/api/shopping/[itemId]/move-to-wishlist/route";

describe("POST /api/shopping/[itemId]/move-to-wishlist", () => {
  beforeEach(() => {
    getAuthedRouteContextMock.mockReset();
    deleteShoppingItemWithSideEffectsMock.mockReset();
    moveShoppingToWishlistWithSideEffectsMock.mockReset();
  });

  it("forwards auth guard responses", async () => {
    getAuthedRouteContextMock.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await POSTMoveToWishlist(
      new Request("http://localhost/api/shopping/shop-1/move-to-wishlist", {
        method: "POST",
      }),
      { params: Promise.resolve({ itemId: "shop-1" }) },
    );

    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(401);
  });

  it("moves shopping item back to wishlist and returns item payload", async () => {
    getAuthedRouteContextMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
      applyCookies: vi.fn(),
    });
    moveShoppingToWishlistWithSideEffectsMock.mockResolvedValue(undefined);

    const response = await POSTMoveToWishlist(
      new Request("http://localhost/api/shopping/shop-1/move-to-wishlist", {
        method: "POST",
      }),
      { params: Promise.resolve({ itemId: "shop-1" }) },
    );

    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(200);
    expect(moveShoppingToWishlistWithSideEffectsMock).toHaveBeenCalledWith(
      {},
      "user-1",
      "shop-1",
    );
    await expect(response.json()).resolves.toEqual({
      item: { itemId: "shop-1" },
    });
  });

  it("deletes shopping item and linked transactions through side effects", async () => {
    getAuthedRouteContextMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
      applyCookies: vi.fn(),
    });
    deleteShoppingItemWithSideEffectsMock.mockResolvedValue(undefined);
    const response = await DELETEShoppingItem(
      new Request("http://localhost/api/shopping/shop-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ itemId: "shop-1" }) },
    );

    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(200);
    expect(deleteShoppingItemWithSideEffectsMock).toHaveBeenCalledWith(
      {},
      "user-1",
      "shop-1",
    );
    await expect(response.json()).resolves.toEqual({
      item: { itemId: "shop-1" },
    });
  });
});
