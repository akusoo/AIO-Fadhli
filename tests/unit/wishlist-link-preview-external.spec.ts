import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getWishLinkPreviewExternalMode,
  resolveWishLinkPreviewViaExternalService,
} from "@/lib/server/wishlist-link-preview-external";

describe("wishlist link preview external resolver", () => {
  const originalResolverUrl = process.env.WISHLIST_LINK_RESOLVER_URL;
  const originalResolverToken = process.env.WISHLIST_LINK_RESOLVER_TOKEN;

  beforeEach(() => {
    delete process.env.WISHLIST_LINK_RESOLVER_URL;
    delete process.env.WISHLIST_LINK_RESOLVER_TOKEN;
    vi.spyOn(globalThis, "fetch").mockReset();
  });

  afterEach(() => {
    if (originalResolverUrl) {
      process.env.WISHLIST_LINK_RESOLVER_URL = originalResolverUrl;
    } else {
      delete process.env.WISHLIST_LINK_RESOLVER_URL;
    }

    if (originalResolverToken) {
      process.env.WISHLIST_LINK_RESOLVER_TOKEN = originalResolverToken;
    } else {
      delete process.env.WISHLIST_LINK_RESOLVER_TOKEN;
    }
  });

  it("returns null when no external strategy is available for the host", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(
      resolveWishLinkPreviewViaExternalService("https://www.example.com/item"),
    ).resolves.toBeNull();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks Tokopedia as required and Shopee as preferred when a resolver URL is configured", () => {
    process.env.WISHLIST_LINK_RESOLVER_URL = "https://resolver.example.com/preview";

    expect(
      getWishLinkPreviewExternalMode("https://www.tokopedia.com/jakartasepeda/sepeda-gravel-bike"),
    ).toBe("required");
    expect(
      getWishLinkPreviewExternalMode("https://shopee.co.id/example-product-i.1.2"),
    ).toBe("preferred");
    expect(getWishLinkPreviewExternalMode("https://www.example.com/item")).toBe("off");
  });

  it("recovers Tokopedia links through the hosted reader fallback", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        `
Title: Sepeda Gravel Bike POLICE TORONTO - Dark Purple di Jktsepeda | Tokopedia

URL Source: http://www.tokopedia.com/jakartasepeda/sepeda-gravel-bike-police-toronto-1733551093865154096

Markdown Content:
# Jual Sepeda Gravel Bike POLICE TORONTO - Dark Purple - Jakarta Barat - Jktsepeda | Tokopedia

![Image 1: tokopedia-logo](https://p16-assets-sg.tokopedia-static.net/assets/logo.svg)
![Image 2: Gambar Sepeda Gravel Bike POLICE TORONTO - Dark Purple](https://p19-images-sign-sg.tokopedia-static.net/product-main.jpeg)

Rp2.950.000
        `,
        {
          status: 200,
          headers: {
            "content-type": "text/plain; charset=utf-8",
          },
        },
      ),
    );

    await expect(
      resolveWishLinkPreviewViaExternalService(
        "https://www.tokopedia.com/jakartasepeda/sepeda-gravel-bike-police-toronto-1733551093865154096?t_id=1775382826980",
      ),
    ).resolves.toMatchObject({
      imageUrl: "https://p19-images-sign-sg.tokopedia-static.net/product-main.jpeg",
      siteName: "Tokopedia",
      sourceUrl:
        "https://www.tokopedia.com/jakartasepeda/sepeda-gravel-bike-police-toronto-1733551093865154096?t_id=1775382826980",
      targetPrice: 2_950_000,
      title: "Sepeda Gravel Bike POLICE TORONTO - Dark Purple",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://r.jina.ai/http://www.tokopedia.com/jakartasepeda/sepeda-gravel-bike-police-toronto-1733551093865154096",
    );
  });

  it("prefers the configured resolver before falling back to the hosted reader", async () => {
    process.env.WISHLIST_LINK_RESOLVER_URL = "https://resolver.example.com/preview";
    process.env.WISHLIST_LINK_RESOLVER_TOKEN = "secret-token";

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            item: {
              imageUrl: "https://images.example.com/gravel-bike.jpg",
              siteName: "Tokopedia",
              sourceUrl:
                "https://www.tokopedia.com/jakartasepeda/sepeda-gravel-bike-police-toronto-1733551093865154096",
              targetPrice: 2_950_000,
              title: "Sepeda Gravel Bike Police Toronto",
            },
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json; charset=utf-8",
            },
          },
        ),
      );

    await expect(
      resolveWishLinkPreviewViaExternalService(
        "https://www.tokopedia.com/jakartasepeda/sepeda-gravel-bike-police-toronto-1733551093865154096",
      ),
    ).resolves.toMatchObject({
      imageUrl: "https://images.example.com/gravel-bike.jpg",
      siteName: "Tokopedia",
      sourceUrl:
        "https://www.tokopedia.com/jakartasepeda/sepeda-gravel-bike-police-toronto-1733551093865154096",
      targetPrice: 2_950_000,
      title: "Sepeda Gravel Bike Police Toronto",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://resolver.example.com/preview");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer secret-token",
        "Content-Type": "application/json",
      },
    });
  });

  it("throws when the configured resolver returns an invalid payload", async () => {
    process.env.WISHLIST_LINK_RESOLVER_URL = "https://resolver.example.com/preview";

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
        },
      }),
    );

    await expect(
      resolveWishLinkPreviewViaExternalService("https://www.example.com/item"),
    ).rejects.toThrow("Resolver eksternal tidak mengembalikan item yang valid.");
  });

  it("falls back to the hosted reader when the configured resolver fails", async () => {
    process.env.WISHLIST_LINK_RESOLVER_URL = "https://resolver.example.com/preview";

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("resolver unavailable"))
      .mockResolvedValueOnce(
        new Response(
          `
Title: Sepeda Gravel Bike POLICE TORONTO - Dark Purple di Jktsepeda | Tokopedia

Markdown Content:
![Image 2: Gambar Sepeda Gravel Bike POLICE TORONTO - Dark Purple](https://p19-images-sign-sg.tokopedia-static.net/product-main.jpeg)

Rp2.950.000
          `,
          {
            status: 200,
            headers: {
              "content-type": "text/plain; charset=utf-8",
            },
          },
        ),
      );

    await expect(
      resolveWishLinkPreviewViaExternalService(
        "https://www.tokopedia.com/jakartasepeda/sepeda-gravel-bike-police-toronto-1733551093865154096?t_id=1775382826980",
      ),
    ).resolves.toMatchObject({
      imageUrl: "https://p19-images-sign-sg.tokopedia-static.net/product-main.jpeg",
      targetPrice: 2_950_000,
      title: "Sepeda Gravel Bike POLICE TORONTO - Dark Purple",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://resolver.example.com/preview");
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://r.jina.ai/http://www.tokopedia.com/jakartasepeda/sepeda-gravel-bike-police-toronto-1733551093865154096",
    );
  });
});
