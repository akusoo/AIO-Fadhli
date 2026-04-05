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

function createHtmlResponse(body: string, url: string) {
  const response = new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
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
      createHtmlResponse(productFixture, "https://www.tokopedia.com/fadhli/keyboard-wireless"),
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
      createHtmlResponse(
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
      createHtmlResponse(
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
      createHtmlResponse(
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
      createHtmlResponse(
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
      createHtmlResponse(
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
});
