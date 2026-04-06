import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAuthedRouteContextMock,
  buildAppSnapshotMock,
  moveShoppingToWishlistWithSideEffectsMock,
} = vi.hoisted(() => ({
  getAuthedRouteContextMock: vi.fn(),
  buildAppSnapshotMock: vi.fn(),
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
  buildAppSnapshot: buildAppSnapshotMock,
  moveShoppingToWishlistWithSideEffects: moveShoppingToWishlistWithSideEffectsMock,
}));

import { POST as POSTMoveToWishlist } from "@/app/api/shopping/[itemId]/move-to-wishlist/route";

describe("POST /api/shopping/[itemId]/move-to-wishlist", () => {
  beforeEach(() => {
    getAuthedRouteContextMock.mockReset();
    buildAppSnapshotMock.mockReset();
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

  it("moves shopping item back to wishlist and returns snapshot", async () => {
    getAuthedRouteContextMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
      applyCookies: vi.fn(),
    });
    moveShoppingToWishlistWithSideEffectsMock.mockResolvedValue(undefined);
    buildAppSnapshotMock.mockResolvedValue({ wishItems: [{ id: "wish-1" }], shoppingItems: [] });

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
      snapshot: { wishItems: [{ id: "wish-1" }], shoppingItems: [] },
    });
  });
});
