import fs from "node:fs";
import path from "node:path";
import { lookup } from "node:dns/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createWishLinkPreviewFallback,
  resolveWishLinkPreview,
} from "@/lib/server/wishlist-link-preview";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(),
}));

const lookupMock = vi.mocked(lookup);
const fixturePath = path.join(process.cwd(), "tests/fixtures/wishlist/product.html");
const productFixture = fs.readFileSync(fixturePath, "utf8");

function createResponse(
  body: string,
  url: string,
  options?: { contentType?: string; status?: number },
) {
  const response = new Response(body, {
    status: options?.status ?? 200,
    headers: {
      "content-type": options?.contentType ?? "text/html; charset=utf-8",
    },
  });

  Object.defineProperty(response, "url", {
    configurable: true,
    value: url,
  });

  return response;
}

describe("wishlist link preview", () => {
  beforeEach(() => {
    lookupMock.mockReset();
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
    vi.spyOn(globalThis, "fetch").mockReset();
  });

  it("extracts title, image, site, and price from HTML metadata", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createResponse(productFixture, "https://www.tokopedia.com/fadhli/keyboard-wireless"),
    );

    await expect(
      resolveWishLinkPreview("https://www.tokopedia.com/fadhli/keyboard-wireless"),
    ).resolves.toMatchObject({
      sourceUrl: "https://www.tokopedia.com/fadhli/keyboard-wireless",
      siteName: "Tokopedia",
      title: "Mechanical Keyboard Wireless",
      targetPrice: 1_350_000,
      imageUrl: "https://images.example.com/keyboard.jpg",
    });
  });

  it("falls back to a cleaned slug when metadata cannot be resolved", () => {
    expect(
      createWishLinkPreviewFallback("https://www.example.com/products/keyboard-mechanical"),
    ).toMatchObject({
      siteName: "example.com",
      title: "keyboard mechanical",
    });
  });

  it("rejects private and localhost targets", async () => {
    await expect(resolveWishLinkPreview("http://127.0.0.1/private")).rejects.toThrow(
      "Link privat tidak didukung.",
    );
    await expect(resolveWishLinkPreview("http://localhost/item")).rejects.toThrow(
      "Link lokal atau internal tidak didukung.",
    );
  });

  it("still returns document title when JSON-LD is malformed", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createResponse(
        "<html><head><title>Fallback Title</title><script type=\"application/ld+json\">{broken}</script></head></html>",
        "https://www.example.com/product/fallback-title",
      ),
    );

    await expect(resolveWishLinkPreview("https://www.example.com/product/fallback-title")).resolves.toMatchObject({
      title: "Fallback Title",
      siteName: "example.com",
    });
  });

  it("extracts image object and nested offer price from structured product data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createResponse(
        `
          <html>
            <head>
              <title>Monitor 4K 27 Inch</title>
              <meta itemprop="image" content="https://images.example.com/monitor-meta.jpg" />
              <script type="application/ld+json">
                {
                  "@context": "https://schema.org",
                  "@type": "Product",
                  "name": "Monitor 4K 27 Inch",
                  "image": {
                    "@type": "ImageObject",
                    "url": "https://images.example.com/monitor.jpg"
                  },
                  "offers": {
                    "@type": "AggregateOffer",
                    "lowPrice": "3999000"
                  }
                }
              </script>
            </head>
          </html>
        `,
        "https://shop.example.com/products/monitor-4k",
      ),
    );

    await expect(resolveWishLinkPreview("https://shop.example.com/products/monitor-4k")).resolves.toMatchObject({
      title: "Monitor 4K 27 Inch",
      targetPrice: 3_999_000,
      imageUrl: "https://images.example.com/monitor-meta.jpg",
    });
  });

  it("extracts product data from embedded JSON when meta price and image are missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createResponse(
        `
          <html>
            <head>
              <title>Wireless Earbuds X</title>
              <script type="application/json">
                {
                  "props": {
                    "pageProps": {
                      "product": {
                        "title": "Wireless Earbuds X",
                        "primaryImage": {
                          "url": "https://images.example.com/earbuds.jpg"
                        },
                        "pricing": {
                          "price": "749000"
                        }
                      }
                    }
                  }
                }
              </script>
            </head>
          </html>
        `,
        "https://store.example.com/products/earbuds-x",
      ),
    );

    await expect(resolveWishLinkPreview("https://store.example.com/products/earbuds-x")).resolves.toMatchObject({
      title: "Wireless Earbuds X",
      targetPrice: 749_000,
      imageUrl: "https://images.example.com/earbuds.jpg",
    });
  });

  it("extracts snake_case image and current retail price from embedded product state", async () => {
    const serializedState = JSON.stringify({
      props: {
        pageProps: {
          product: {
            product_description: {
              title: "Calming Vibes Hedgehog Soother",
            },
            buy_url: "https://www.target.com/p/hedgehog-soother/-/A-76152363",
            image_info: {
              primary_image: {
                url: "https://images.example.com/hedgehog.jpg",
              },
            },
            price: {
              current_retail: 18.99,
              formatted_current_price: "$18.99",
            },
          },
          attachment: {
            title: "2 Year Protection Plan",
            buy_url: "https://www.target.com/p/other-item/-/A-123",
            primary_image: "https://images.example.com/protection-plan.jpg",
            price: {
              current_retail: 6,
            },
          },
        },
      },
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createResponse(
        `
          <html>
            <head>
              <title>Calming Vibes Hedgehog Soother</title>
              <script type="application/json">
                window.__PRELOADED_STATE__ = JSON.parse(${JSON.stringify(serializedState)});
              </script>
            </head>
          </html>
        `,
        "https://www.target.com/p/hedgehog-soother/-/A-76152363",
      ),
    );

    await expect(resolveWishLinkPreview("https://www.target.com/p/hedgehog-soother/-/A-76152363")).resolves.toMatchObject({
      title: "Calming Vibes Hedgehog Soother",
      targetPrice: 19,
      imageUrl: "https://images.example.com/hedgehog.jpg",
    });
  });

  it("falls back to inline HTML price and image patterns when script data is not valid JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createResponse(
        `
          <html>
            <head>
              <title>Portable Projector Mini</title>
              <meta property="og:title" content="Portable Projector Mini" />
              <script>
                window.__STATE__ = {\"product\":{\"url\":\"/products/projector-mini\",\"price\":{\"current_retail\":129.99,\"formatted_current_price\":\"$129.99\"},\"image_info\":{\"primary_image_url\":\"https:\\/\\/images.example.com\\/projector.jpg\"}}};
              </script>
            </head>
          </html>
        `,
        "https://shop.example.com/products/projector-mini",
      ),
    );

    await expect(resolveWishLinkPreview("https://shop.example.com/products/projector-mini")).resolves.toMatchObject({
      title: "Portable Projector Mini",
      targetPrice: 130,
      imageUrl: "https://images.example.com/projector.jpg",
    });
  });

  it("retries Shopee with an alternate fetch profile until product metadata is available", async () => {
    const requestedUserAgents: string[] = [];
    const shopeeUrl =
      "https://shopee.co.id/Jas-Hujan-Stelan-Series-Shine-Mantel-Baju-Celana-Raincoat-Set-Ultralight-Raincoat-Waterproof-i.286504037.29038098149";

    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const userAgent = headers["User-Agent"] ?? "";
      requestedUserAgents.push(userAgent);

      if (userAgent === "Twitterbot/1.0") {
        return createResponse(
          `
            <html>
              <head>
                <title>Halaman Tidak Tersedia</title>
              </head>
              <body>Maaf, telah terjadi kesalahan. Silakan log in dan coba lagi.</body>
            </html>
          `,
          shopeeUrl,
        );
      }

      return createResponse(
        `
          <html>
            <head>
              <title>Jual Jas Hujan Stelan Series Shine / Mantel Baju Celana / Raincoat Set Ultralight / Raincoat Waterproof | Shopee Indonesia</title>
              <meta property="og:title" content="Jual Jas Hujan Stelan Series Shine / Mantel Baju Celana / Raincoat Set Ultralight / Raincoat Waterproof | Shopee Indonesia" />
              <meta property="og:image" content="https://down-id.img.susercontent.com/file/id-11134207-7ra0j-mbhg5v94na0412" />
              <script type="application/ld+json">
                {
                  "@context": "http://schema.org",
                  "@type": "Product",
                  "name": "Jas Hujan Stelan Series Shine / Mantel Baju Celana / Raincoat Set Ultralight / Raincoat Waterproof",
                  "image": "https://down-id.img.susercontent.com/file/id-11134207-7ra0j-mbhg5v94na0412",
                  "offers": {
                    "@type": "Offer",
                    "price": "235000.00",
                    "priceCurrency": "IDR"
                  }
                }
              </script>
            </head>
          </html>
        `,
        shopeeUrl,
      );
    });

    await expect(resolveWishLinkPreview(shopeeUrl)).resolves.toMatchObject({
      imageUrl: "https://down-id.img.susercontent.com/file/id-11134207-7ra0j-mbhg5v94na0412",
      siteName: "shopee.co.id",
      sourceUrl: shopeeUrl,
      targetPrice: 235_000,
      title:
        "Jual Jas Hujan Stelan Series Shine / Mantel Baju Celana / Raincoat Set Ultralight / Raincoat Waterproof | Shopee Indonesia",
    });

    expect(requestedUserAgents).toEqual([
      "Twitterbot/1.0",
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    ]);
  });

  it("retries with a stripped canonical URL when tracking params cause a timeout", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const requestedUrl = new URL(String(input));

      if (requestedUrl.searchParams.has("t_id")) {
        const timeoutError = new Error("timed out");
        timeoutError.name = "AbortError";
        throw timeoutError;
      }

      return createResponse(
        `
          <html>
            <head>
              <meta property="og:title" content="Gravel Bike Police Toronto" />
              <meta property="og:image" content="https://images.example.com/gravel-bike.jpg" />
              <meta property="product:price:amount" content="2950000" />
            </head>
          </html>
        `,
        "https://www.tokopedia.com/jakartasepeda/sepeda-gravel-bike-police-toronto-1733551093865154096",
      );
    });

    await expect(
      resolveWishLinkPreview(
        "https://www.tokopedia.com/jakartasepeda/sepeda-gravel-bike-police-toronto-1733551093865154096?t_id=1775382826980&t_st=1",
      ),
    ).resolves.toMatchObject({
      sourceUrl:
        "https://www.tokopedia.com/jakartasepeda/sepeda-gravel-bike-police-toronto-1733551093865154096",
      title: "Gravel Bike Police Toronto",
      targetPrice: 2_950_000,
      imageUrl: "https://images.example.com/gravel-bike.jpg",
    });
  });

  it("parses product HTML even when the origin returns a non-200 response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createResponse(
        `
          <html>
            <head>
              <title>Portable SSD 2TB</title>
              <meta property="og:title" content="Portable SSD 2TB" />
              <meta property="og:image" content="https://images.example.com/ssd.jpg" />
              <meta property="product:price:amount" content="1899000" />
            </head>
          </html>
        `,
        "https://shop.example.com/products/portable-ssd",
        { status: 403 },
      ),
    );

    await expect(
      resolveWishLinkPreview("https://shop.example.com/products/portable-ssd"),
    ).resolves.toMatchObject({
      title: "Portable SSD 2TB",
      targetPrice: 1_899_000,
      imageUrl: "https://images.example.com/ssd.jpg",
    });
  });

  it("extracts product data from standalone JSON responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createResponse(
        JSON.stringify({
          product: {
            title: "Action Camera 4K",
            primary_image_url: "https://images.example.com/action-cam.jpg",
            priceInfo: {
              formatted_current_price: "Rp 1.299.000",
            },
            url: "https://shop.example.com/products/action-camera-4k",
          },
        }),
        "https://shop.example.com/products/action-camera-4k",
        { contentType: "application/json; charset=utf-8" },
      ),
    );

    await expect(
      resolveWishLinkPreview("https://shop.example.com/products/action-camera-4k"),
    ).resolves.toMatchObject({
      sourceUrl: "https://shop.example.com/products/action-camera-4k",
      title: "Action Camera 4K",
      targetPrice: 1_299_000,
      imageUrl: "https://images.example.com/action-cam.jpg",
    });
  });
});
