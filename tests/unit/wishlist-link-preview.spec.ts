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
});
