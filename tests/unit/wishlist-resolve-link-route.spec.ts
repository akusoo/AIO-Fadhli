import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/wishlist-link-preview", () => ({
  createWishLinkPreviewFallback: vi.fn(),
  getWishLinkPreviewDiagnostics: vi.fn(),
  isRecoverableWishLinkPreviewError: vi.fn(),
  resolveWishLinkPreview: vi.fn(),
}));

vi.mock("@/lib/server/wishlist-link-preview-external", () => ({
  getWishLinkPreviewExternalMode: vi.fn(),
  resolveWishLinkPreviewViaExternalService: vi.fn(),
}));

vi.mock("@/lib/server/routes", () => ({
  errorJson: vi.fn((message: string, status = 400) => Response.json({ message }, { status })),
  getAuthedRouteContext: vi.fn(),
  okJson: vi.fn((payload: unknown) => Response.json(payload, { status: 200 })),
}));

import {
  createWishLinkPreviewFallback,
  getWishLinkPreviewDiagnostics,
  isRecoverableWishLinkPreviewError,
  resolveWishLinkPreview,
} from "@/lib/server/wishlist-link-preview";
import {
  getWishLinkPreviewExternalMode,
  resolveWishLinkPreviewViaExternalService,
} from "@/lib/server/wishlist-link-preview-external";
import { getAuthedRouteContext } from "@/lib/server/routes";
import { POST } from "@/app/api/wishlist/resolve-link/route";

describe("wishlist resolve-link route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getWishLinkPreviewExternalMode).mockReturnValue("off");
    vi.mocked(getAuthedRouteContext).mockResolvedValue({
      applyCookies: undefined,
    } as Awaited<ReturnType<typeof getAuthedRouteContext>>);
  });

  it("uses external-first resolution for hosts that require it", async () => {
    const externalItem = {
      imageUrl: "https://images.example.com/product.jpg",
      siteName: "Tokopedia",
      sourceUrl: "https://www.tokopedia.com/example/item",
      targetPrice: 2_950_000,
      title: "Sepeda Gravel Bike Police Toronto",
    };

    vi.mocked(getWishLinkPreviewExternalMode).mockReturnValue("required");
    vi.mocked(resolveWishLinkPreviewViaExternalService).mockResolvedValue(externalItem);

    const response = await POST(
      new Request("https://example.com/api/wishlist/resolve-link", {
        body: JSON.stringify({
          url: "https://www.tokopedia.com/example/item",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(response).toBeInstanceOf(Response);
    await expect(response!.json()).resolves.toEqual({
      item: externalItem,
      resolution: "parsed",
    });

    expect(resolveWishLinkPreview).not.toHaveBeenCalled();
    expect(createWishLinkPreviewFallback).not.toHaveBeenCalled();
  });

  it("falls back immediately when a required external resolver cannot recover the link", async () => {
    const fallbackItem = {
      siteName: "tokopedia.com",
      sourceUrl: "https://www.tokopedia.com/example/item",
      title: "item",
    };

    vi.mocked(getWishLinkPreviewExternalMode).mockReturnValue("required");
    vi.mocked(resolveWishLinkPreviewViaExternalService).mockResolvedValue(null);
    vi.mocked(createWishLinkPreviewFallback).mockReturnValue(fallbackItem);

    const response = await POST(
      new Request("https://example.com/api/wishlist/resolve-link", {
        body: JSON.stringify({
          url: "https://www.tokopedia.com/example/item",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(response).toBeInstanceOf(Response);
    await expect(response!.json()).resolves.toEqual({
      item: fallbackItem,
      resolution: "fallback",
    });

    expect(resolveWishLinkPreview).not.toHaveBeenCalled();
    expect(createWishLinkPreviewFallback).toHaveBeenCalledWith(
      "https://www.tokopedia.com/example/item",
    );
  });

  it("uses external recovery before falling back when the primary resolver fails recoverably", async () => {
    const recoverableError = new Error("timed out");
    const externalItem = {
      imageUrl: "https://images.example.com/product.jpg",
      siteName: "Tokopedia",
      sourceUrl: "https://www.tokopedia.com/example/item",
      targetPrice: 2_950_000,
      title: "Sepeda Gravel Bike Police Toronto",
    };

    vi.mocked(resolveWishLinkPreview).mockRejectedValue(recoverableError);
    vi.mocked(isRecoverableWishLinkPreviewError).mockReturnValue(true);
    vi.mocked(getWishLinkPreviewDiagnostics).mockReturnValue([
      {
        elapsedMs: 12_000,
        reason: "timeout",
        url: "https://www.tokopedia.com/example/item",
      },
    ]);
    vi.mocked(resolveWishLinkPreviewViaExternalService).mockResolvedValue(externalItem);

    const response = await POST(
      new Request("https://example.com/api/wishlist/resolve-link", {
        body: JSON.stringify({
          url: "https://www.tokopedia.com/example/item",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(response).toBeInstanceOf(Response);
    await expect(response!.json()).resolves.toEqual({
      item: externalItem,
      resolution: "parsed",
    });

    expect(resolveWishLinkPreviewViaExternalService).toHaveBeenCalledWith(
      "https://www.tokopedia.com/example/item",
    );
    expect(createWishLinkPreviewFallback).not.toHaveBeenCalled();
  });

  it("falls back to slug metadata when external recovery returns null", async () => {
    const recoverableError = new Error("timed out");
    const fallbackItem = {
      siteName: "tokopedia.com",
      sourceUrl: "https://www.tokopedia.com/example/item",
      title: "item",
    };

    vi.mocked(resolveWishLinkPreview).mockRejectedValue(recoverableError);
    vi.mocked(isRecoverableWishLinkPreviewError).mockReturnValue(true);
    vi.mocked(getWishLinkPreviewDiagnostics).mockReturnValue([
      {
        elapsedMs: 12_000,
        reason: "timeout",
        url: "https://www.tokopedia.com/example/item",
      },
    ]);
    vi.mocked(resolveWishLinkPreviewViaExternalService).mockResolvedValue(null);
    vi.mocked(createWishLinkPreviewFallback).mockReturnValue(fallbackItem);

    const response = await POST(
      new Request("https://example.com/api/wishlist/resolve-link", {
        body: JSON.stringify({
          url: "https://www.tokopedia.com/example/item",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(response).toBeInstanceOf(Response);
    await expect(response!.json()).resolves.toEqual({
      item: fallbackItem,
      resolution: "fallback",
    });

    expect(resolveWishLinkPreviewViaExternalService).toHaveBeenCalledWith(
      "https://www.tokopedia.com/example/item",
    );
    expect(createWishLinkPreviewFallback).toHaveBeenCalledWith(
      "https://www.tokopedia.com/example/item",
    );
  });
});
